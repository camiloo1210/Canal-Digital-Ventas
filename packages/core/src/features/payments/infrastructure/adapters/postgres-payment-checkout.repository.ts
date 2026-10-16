import type postgres from 'postgres';
import type {
  CheckoutReservation,
  CheckoutResolution,
  PaymentCheckoutRepositoryPort,
  ReserveCheckout,
} from '@/payments/application/ports/out/payment-checkout-repository.port';
import { PaymentCheckoutException } from '@/payments/application/exceptions/payment-checkout.exception';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';
import { isLemonSqueezyCheckoutUrl } from '@/payments/infrastructure/lemon-squeezy-validation';

interface ReservationRow {
  payment_id: string;
  outcome: CheckoutReservation['outcome'];
  order_id: string;
  tenant_id: string;
  amount_cents: number;
  currency: string;
  store_id: string;
  environment: 'test' | 'production';
  checkout_expires_at: Date;
  checkout_creation_token: string | null;
  checkout_url: string | null;
}

export class PostgresPaymentCheckoutRepository implements PaymentCheckoutRepositoryPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async reserve(input: ReserveCheckout): Promise<CheckoutReservation> {
    try {
      const rows = await this.sql<ReservationRow[]>`
        SELECT * FROM sales.create_pending_payment(
          ${input.orderId}::uuid, ${input.authenticatedBuyerId}::uuid,
          'lemon_squeezy', ${input.environment}::text, ${input.ttlSeconds}::int
        )
      `;
      const row = rows[0];
      if (
        !row ||
        ![
          'CREATED',
          'EXISTING_NO_CHECKOUT',
          'EXISTING_WITH_CHECKOUT',
          'BUSY',
          'CREATION_UNAVAILABLE',
          'ALREADY_PAID',
        ].includes(row.outcome) ||
        row.order_id !== input.orderId ||
        row.environment !== input.environment ||
        !Number.isSafeInteger(row.amount_cents) ||
        row.amount_cents <= 0 ||
        (row.checkout_url !== null && !isLemonSqueezyCheckoutUrl(row.checkout_url))
      ) {
        throw new PaymentCheckoutException('INVALID_RESERVATION');
      }
      return {
        paymentId: row.payment_id,
        orderId: row.order_id,
        tenantId: row.tenant_id,
        outcome: row.outcome,
        amountCents: row.amount_cents,
        currency: row.currency,
        storeId: row.store_id,
        environment: row.environment,
        expiresAt: row.checkout_expires_at.toISOString(),
        creationToken: row.checkout_creation_token,
        checkoutUrl: row.checkout_url,
      };
    } catch (error: unknown) {
      return this.fail(error);
    }
  }

  public async resolve(input: CheckoutResolution): Promise<'PENDING' | 'ALREADY_PAID'> {
    try {
      const rows = await this.sql<{ payment_status: string }[]>`
        SELECT * FROM sales.attach_provider_checkout(
          ${input.paymentId}::uuid, ${input.creationToken}::uuid, ${input.mode}::text,
          ${input.checkoutId}::text, ${input.checkoutUrl}::text, ${input.reasonCode}::text
        )
      `;
      const status = rows[0]?.payment_status;
      if (status && ['completed', 'partially_refunded', 'refunded'].includes(status))
        return 'ALREADY_PAID';
      if (status !== 'pending' && !(input.mode === 'REJECTED' && status === 'failed')) {
        throw new PaymentCheckoutException('CREATION_UNAVAILABLE');
      }
      return 'PENDING';
    } catch (error: unknown) {
      return this.fail(error);
    }
  }

  private fail(error: unknown): never {
    if (error instanceof PaymentCheckoutException) throw error;
    if (error instanceof Error && 'code' in error) {
      if (error.code === 'FZ120') throw new PaymentCheckoutException('NOT_FOUND');
      if (error.code === 'FZ121') throw new PaymentCheckoutException('DISABLED');
      if (error.code === 'FZ122') throw new PaymentCheckoutException('NOT_CONFIGURED');
      if (error.code === '55P03') throw new PaymentCheckoutException('BUSY');
    }
    throw new PaymentRepositoryException('Payment checkout persistence failed.', error);
  }
}
