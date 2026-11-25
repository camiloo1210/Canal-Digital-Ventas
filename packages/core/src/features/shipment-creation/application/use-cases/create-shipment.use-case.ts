import type {
  ClaimedJob,
  ShipmentJobRepositoryPort,
} from '@/shipment-creation/application/ports/out/shipment-job-repository.port';
import type { ShipmentCreationSourcePort } from '@/shipment-creation/application/ports/out/shipment-creation-source.port';
import type {
  ShipmentProviderPort,
  ShipmentProviderResult,
} from '@/shipment-creation/application/ports/out/shipment-provider.port';
import type { LabelStoragePort } from '@/shipment-creation/application/ports/out/label-storage.port';
import type { CarrierShipmentRecordPort } from '@/shipment-creation/application/ports/out/carrier-shipment-record.port';
import type { ShippingOriginRepositoryPort } from '@/tenants/application/ports/out/shipping-origin-repository.port';
import type { TrackingActivationRepositoryPort } from '@/shipment-tracking/application/use-cases/enable-tracking.use-case';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import {
  calculateShipmentPackage,
  type ShipmentPackage,
} from '@/shipment-creation/domain/shipment-package';
import { MissingPackageDataException } from '@/shipment-creation/domain/exceptions/missing-package-data.exception';
import { InvalidShipmentQuantityException } from '@/shipment-creation/domain/exceptions/invalid-shipment-quantity.exception';
import { ShipmentProviderRejectedException } from '@/shipment-creation/application/exceptions/shipment-provider-rejected.exception';
import { ApplicationException } from '@/shared/application/exceptions/application.exception';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { normalizeCountryCode } from '@/shipment-creation/domain/country-code';

/**
 * The carrier created the shipment but recording it failed; the job was left for the seller.
 * Carries the carrier tracking number (not a secret) so the caller can log it for recovery.
 */
export class ShipmentCompletionException extends ApplicationException {
  public constructor(public readonly providerTrackingNumber: string) {
    super('Carrier shipment created but could not be recorded');
  }
}

export interface CreateShipmentConfig {
  readonly accountNumber: string;
  readonly serviceType: string;
  /** Audit identity of the shipment-creation worker (not a customer identity). */
  readonly systemActorId: string;
  readonly credentialRefForTenant: (tenantId: string) => string | null;
}

export class CreateShipmentUseCase {
  public constructor(
    private readonly jobs: ShipmentJobRepositoryPort,
    private readonly sources: ShipmentCreationSourcePort,
    private readonly origins: Pick<ShippingOriginRepositoryPort, 'find'>,
    private readonly provider: ShipmentProviderPort,
    private readonly labels: LabelStoragePort,
    private readonly shipments: CarrierShipmentRecordPort,
    private readonly tracking: Pick<TrackingActivationRepositoryPort, 'enable'>,
    private readonly transactions: TransactionManagerPort,
    private readonly config: CreateShipmentConfig,
  ) {}

  public async execute(job: ClaimedJob): Promise<void> {
    // A previous worker died after committing `creating`: the carrier may hold a shipment.
    if (job.claimedFrom === 'creating') {
      await this.jobs.markNeedsAttention(job, 'AMBIGUOUS_RESULT');
      return;
    }

    const source = await this.sources.load(job.tenantId, job.orderId);
    if (!source || source.orderStatus !== OrderStatus.PROCESSING) {
      await this.jobs.markFailed(job, 'ORDER_NOT_PROCESSING');
      return;
    }
    // Never create a second shipment nor overwrite a tracking number already on the order
    // (e.g. typed by the seller in the manual form while the job waited).
    if (source.hasRecordedShipment) {
      await this.jobs.markNeedsAttention(job, 'SHIPMENT_ALREADY_RECORDED');
      return;
    }
    let shipmentPackage: ShipmentPackage;
    try {
      shipmentPackage = calculateShipmentPackage(source.items);
    } catch (error: unknown) {
      if (error instanceof MissingPackageDataException) {
        await this.jobs.markNeedsAttention(job, 'MISSING_PACKAGE_DATA');
        return;
      }
      if (error instanceof InvalidShipmentQuantityException) {
        await this.jobs.markNeedsAttention(job, 'INVALID_PACKAGE_DATA');
        return;
      }
      throw error;
    }
    const origin = await this.origins.find(job.tenantId);
    if (!origin) {
      await this.jobs.markNeedsAttention(job, 'MISSING_ORIGIN');
      return;
    }
    const recipientCountry = normalizeCountryCode(source.recipient.country);
    if (!recipientCountry) {
      await this.jobs.markFailed(job, 'INVALID_RECIPIENT_COUNTRY');
      return;
    }
    const originCountry = normalizeCountryCode(origin.country);
    if (!originCountry) {
      await this.jobs.markFailed(job, 'INVALID_ORIGIN_COUNTRY');
      return;
    }
    const credentialRef = this.config.credentialRefForTenant(job.tenantId);
    if (!credentialRef) {
      await this.jobs.markNeedsAttention(job, 'MISSING_CREDENTIALS');
      return;
    }

    // Committed in its own transaction before the carrier call (anti-duplicate fence).
    if (!(await this.jobs.markCreating(job))) return;

    let result: ShipmentProviderResult;
    try {
      result = await this.provider.create({
        credentialRef,
        origin: { ...origin, country: originCountry },
        recipient: { ...source.recipient, country: recipientCountry },
        package: shipmentPackage,
        accountNumber: this.config.accountNumber,
        serviceType: this.config.serviceType,
      });
    } catch (error: unknown) {
      if (error instanceof ShipmentProviderRejectedException) {
        await this.jobs.markFailed(job, error.code);
      } else {
        await this.jobs.markNeedsAttention(job, 'AMBIGUOUS_RESULT');
      }
      return;
    }

    // The shipment exists at the carrier from here on. Persist its number first, without the
    // lease, so a later failure or a lost lease can never lose it (a retry would duplicate it).
    try {
      await this.jobs.recordProviderTrackingNumber(job, result.trackingNumber);
    } catch {
      // Best effort: the success transaction below records it too.
    }

    // Never fail the job for a missing label.
    let labelPath: string | null;
    try {
      labelPath = await this.labels.put(job.tenantId, result.labelPdf);
    } catch {
      labelPath = null;
    }

    try {
      await this.transactions.runInTransaction(
        async (tx): Promise<void> => {
          await this.shipments.record(
            {
              tenantId: job.tenantId,
              orderId: job.orderId,
              carrier: 'FedEx',
              trackingNumber: result.trackingNumber,
              actorId: this.config.systemActorId,
            },
            tx,
          );
          await this.tracking.enable(
            {
              tenantId: job.tenantId,
              orderId: job.orderId,
              trackingNumber: result.trackingNumber,
              provider: 'fedex',
            },
            tx,
          );
          await this.jobs.complete(job, labelPath, tx);
        },
        { userId: this.config.systemActorId, tenantId: job.tenantId },
      );
    } catch {
      // The shipment exists at the carrier: keep its tracking number on the job (which blocks
      // any retry) so the seller can record it manually instead of creating a duplicate.
      await this.jobs
        .markNeedsAttention(job, 'AMBIGUOUS_RESULT', result.trackingNumber)
        .catch((): void => {});
      throw new ShipmentCompletionException(result.trackingNumber);
    }
  }
}
