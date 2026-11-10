import type {
  ShipmentProviderInput,
  ShipmentProviderPort,
  ShipmentProviderResult,
} from '@/shipment-creation/application/ports/out/shipment-provider.port';
import type { ShipmentPackage } from '@/shipment-creation/domain/shipment-package';
import { ShipmentProviderRejectedException } from '@/shipment-creation/application/exceptions/shipment-provider-rejected.exception';
import { ShipmentProviderAmbiguousException } from '@/shipment-creation/application/exceptions/shipment-provider-ambiguous.exception';
import { TrackingAuthorizationException } from '@/shipment-tracking/application/tracking-authorization.exception';

const SHIP_URL = 'https://apis-sandbox.fedex.com/ship/v1/shipments';
const TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 5242880;
const SAFE_CODE = /^[A-Z0-9][A-Z0-9._-]{0,79}$/;
const ISO_COUNTRY = /^[A-Z]{2}$/;
const TRACKING_NUMBER = /^[A-Za-z0-9]{1,120}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

interface FedexTokenSource {
  getToken(ref: string): Promise<string>;
  invalidate(ref: string): void;
}

interface FedexParty {
  readonly contact: { readonly personName: string; readonly phoneNumber: string };
  readonly address: {
    readonly streetLines: readonly string[];
    readonly city: string;
    readonly stateOrProvinceCode?: string;
    readonly postalCode: string;
    readonly countryCode: string;
  };
}

/** Thrown internally once the request is known not to have been sent. */
class NotSentException extends Error {
  public constructor(public readonly code: string) {
    super('not sent');
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstOf(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) && value.length > 0 ? record(value[0]) : null;
}

/** Integer ceiling division of two positive safe integers (no fractional value is persisted). */
function ceilDiv(value: number, divisor: number): number {
  return Math.floor((value + divisor - 1) / divisor);
}

/** Grams → kilograms rounded up to 0.01 kg, built as a decimal string from integers. */
function kilograms(grams: number): number {
  const centi = Math.max(1, ceilDiv(grams, 10));
  const fraction = String(centi % 100).padStart(2, '0');
  return Number(`${Math.floor(centi / 100)}.${fraction}`);
}

function party(input: {
  readonly name: string;
  readonly phone: string;
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}): FedexParty {
  const country = input.country.trim().toUpperCase();
  const state = input.state.trim().toUpperCase();
  return {
    contact: { personName: input.name.trim(), phoneNumber: input.phone.trim() },
    address: {
      streetLines: [input.street.trim()],
      city: input.city.trim(),
      // FedEx expects a two-letter code; free-text regions are omitted instead of guessed.
      ...(ISO_COUNTRY.test(state) ? { stateOrProvinceCode: state } : {}),
      postalCode: input.zipCode.trim(),
      countryCode: country,
    },
  };
}

/** Single mapping point for the FedEx Ship API request body. */
export function buildFedexShipmentRequest(
  input: ShipmentProviderInput,
  shipDate: Date,
): Record<string, unknown> {
  const pkg: ShipmentPackage = input.package;
  return {
    labelResponseOptions: 'LABEL',
    accountNumber: { value: input.accountNumber },
    requestedShipment: {
      shipper: party({ ...input.origin, name: input.origin.contactName }),
      recipients: [party(input.recipient)],
      shipDatestamp: shipDate.toISOString().slice(0, 10),
      serviceType: input.serviceType,
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      shippingChargesPayment: { paymentType: 'SENDER' },
      labelSpecification: { imageType: 'PDF', labelStockType: 'PAPER_4X6' },
      requestedPackageLineItems: [
        {
          weight: { units: 'KG', value: kilograms(pkg.weightGrams) },
          dimensions: {
            length: ceilDiv(pkg.lengthMm, 10),
            width: ceilDiv(pkg.widthMm, 10),
            height: ceilDiv(pkg.heightMm, 10),
            units: 'CM',
          },
        },
      ],
    },
  };
}

/** Single mapping point for the FedEx Ship API success body; null when it is not usable. */
export function parseFedexShipmentResponse(payload: unknown): ShipmentProviderResult | null {
  const shipment = firstOf(record(record(payload)?.output)?.transactionShipments);
  const trackingNumber = shipment?.masterTrackingNumber;
  if (typeof trackingNumber !== 'string' || !TRACKING_NUMBER.test(trackingNumber)) return null;
  const document = firstOf(firstOf(shipment?.pieceResponses)?.packageDocuments);
  const label = document?.encodedLabel;
  if (typeof label !== 'string' || !BASE64.test(label)) return null;
  const bytes = new Uint8Array(Buffer.from(label, 'base64'));
  const header = new TextDecoder().decode(bytes.subarray(0, 5));
  if (header !== '%PDF-') return null;
  return { trackingNumber, labelPdf: bytes };
}

function rejectionCode(payload: unknown): string | null {
  const code = firstOf(record(payload)?.errors)?.code;
  if (code === undefined) return null;
  return typeof code === 'string' && SAFE_CODE.test(code) ? code : 'PROVIDER_REJECTED';
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

export class FedexShipAdapter implements ShipmentProviderPort {
  public constructor(
    private readonly auth: FedexTokenSource,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = (): Date => new Date(),
  ) {}

  private async token(ref: string): Promise<string> {
    try {
      return await this.auth.getToken(ref);
    } catch (error: unknown) {
      throw new NotSentException(
        error instanceof TrackingAuthorizationException ? 'AUTHORIZATION' : 'PROVIDER_UNAVAILABLE',
      );
    }
  }

  public async create(input: ShipmentProviderInput): Promise<ShipmentProviderResult> {
    try {
      if (!ISO_COUNTRY.test(input.recipient.country.trim().toUpperCase()))
        throw new NotSentException('INVALID_RECIPIENT_COUNTRY');
      if (!ISO_COUNTRY.test(input.origin.country.trim().toUpperCase()))
        throw new NotSentException('INVALID_ORIGIN_COUNTRY');
      if (!input.accountNumber || !input.serviceType)
        throw new NotSentException('PROVIDER_CONFIGURATION');
      const body = JSON.stringify(buildFedexShipmentRequest(input, this.now()));
      const send = async (token: string): Promise<Response> =>
        this.fetcher(SHIP_URL, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body,
        });
      let response = await send(await this.token(input.credentialRef));
      if (response.status === 401) {
        // A 401 is answered before the shipment is processed, so one refresh is safe.
        this.auth.invalidate(input.credentialRef);
        response = await send(await this.token(input.credentialRef));
      }
      if (response.status === 401 || response.status === 403)
        throw new NotSentException('AUTHORIZATION');
      const payload = await readJson(response);
      if (response.status === 400 || response.status === 404 || response.status === 422) {
        const code = rejectionCode(payload);
        if (code !== null) throw new NotSentException(code);
        throw new ShipmentProviderAmbiguousException();
      }
      if (!response.ok) throw new ShipmentProviderAmbiguousException();
      const result = parseFedexShipmentResponse(payload);
      if (!result) throw new ShipmentProviderAmbiguousException();
      return result;
    } catch (error: unknown) {
      if (error instanceof NotSentException)
        throw new ShipmentProviderRejectedException(error.code);
      throw new ShipmentProviderAmbiguousException();
    }
  }
}
