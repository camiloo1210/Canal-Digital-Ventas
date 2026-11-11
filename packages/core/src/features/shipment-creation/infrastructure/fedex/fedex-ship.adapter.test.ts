import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  buildFedexShipmentRequest,
  FedexShipAdapter,
} from '@/shipment-creation/infrastructure/fedex/fedex-ship.adapter';
import { ShipmentProviderRejectedException } from '@/shipment-creation/application/exceptions/shipment-provider-rejected.exception';
import { ShipmentProviderAmbiguousException } from '@/shipment-creation/application/exceptions/shipment-provider-ambiguous.exception';
import type { ShipmentProviderInput } from '@/shipment-creation/application/ports/out/shipment-provider.port';
import { TrackingAuthorizationException } from '@/shipment-tracking/application/tracking-authorization.exception';
import { FedexTransientException } from '@/shipment-tracking/infrastructure/fedex/fedex-auth.adapter';

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const encoded = Buffer.from(PDF).toString('base64');
const success = {
  transactionId: 't-1',
  output: {
    transactionShipments: [
      {
        masterTrackingNumber: '794699999999',
        pieceResponses: [
          { trackingNumber: '794699999999', packageDocuments: [{ encodedLabel: encoded }] },
        ],
      },
    ],
  },
};
const input: ShipmentProviderInput = {
  credentialRef: 'store',
  origin: {
    contactName: 'Store',
    phone: '3000000000',
    street: 'Calle 1',
    city: 'Bogota',
    state: 'DC',
    zipCode: '110111',
    country: 'CO',
  },
  recipient: {
    name: 'Buyer',
    phone: '3100000000',
    street: 'Carrera 2',
    city: 'Medellin',
    state: 'Antioquia',
    zipCode: '050001',
    country: 'CO',
  },
  package: { weightGrams: 1234, lengthMm: 301, widthMm: 200, heightMm: 95 },
  accountNumber: '740561073',
  serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
};
type TokenMocks = {
  getToken: Mock<(ref: string) => Promise<string>>;
  invalidate: Mock<(ref: string) => void>;
};
const tokenSource = (getToken: Mock<(ref: string) => Promise<string>>): TokenMocks => ({
  getToken,
  invalidate: vi.fn<(ref: string) => void>(),
});
const auth = (): TokenMocks => ({
  getToken: vi.fn<(ref: string) => Promise<string>>().mockResolvedValue('secret-token'),
  invalidate: vi.fn<(ref: string) => void>(),
});
const now = (): Date => new Date('2026-11-09T16:00:00Z');
const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), { status });

describe('FedEx ship adapter', (): void => {
  it('converts domestic US packages to pounds and whole inches without understating measurements', (): void => {
    const body = buildFedexShipmentRequest(
      {
        ...input,
        origin: { ...input.origin, country: ' us ' },
        recipient: { ...input.recipient, country: 'US' },
        package: { weightGrams: 453, lengthMm: 254, widthMm: 255, heightMm: 1 },
      },
      now(),
    ) as { requestedShipment: { requestedPackageLineItems: unknown[] } };
    expect(body.requestedShipment.requestedPackageLineItems[0]).toEqual({
      weight: { units: 'LB', value: 1 },
      dimensions: { length: 10, width: 11, height: 1, units: 'IN' },
    });
  });

  it('retains metric units when only the origin is in the US', (): void => {
    const body = buildFedexShipmentRequest(
      {
        ...input,
        origin: { ...input.origin, country: 'US' },
      },
      now(),
    ) as { requestedShipment: { requestedPackageLineItems: unknown[] } };
    expect(body.requestedShipment.requestedPackageLineItems[0]).toEqual({
      weight: { units: 'KG', value: 1.24 },
      dimensions: { length: 31, width: 20, height: 10, units: 'CM' },
    });
  });

  it.each([
    { grams: 1, pounds: 0.01 },
    { grams: 454, pounds: 1.01 },
    { grams: 1234, pounds: 2.73 },
  ])('rounds $grams grams up to $pounds pounds', ({ grams, pounds }): void => {
    const body = buildFedexShipmentRequest(
      {
        ...input,
        origin: { ...input.origin, country: 'US' },
        recipient: { ...input.recipient, country: 'US' },
        package: { ...input.package, weightGrams: grams },
      },
      now(),
    ) as { requestedShipment: { requestedPackageLineItems: { weight: unknown }[] } };
    expect(body.requestedShipment.requestedPackageLineItems[0]?.weight).toEqual({
      units: 'LB',
      value: pounds,
    });
  });
  it('posts the documented shipment and returns tracking number and decoded label', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(json(200, success));
    const result = await new FedexShipAdapter(auth(), fetcher, now).create(input);
    expect(result.trackingNumber).toBe('794699999999');
    expect(Array.from(result.labelPdf)).toEqual(Array.from(PDF));
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://apis-sandbox.fedex.com/ship/v1/shipments');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret-token');
    const body = JSON.parse(String(init.body)) as {
      accountNumber: { value: string };
      labelResponseOptions: string;
      requestedShipment: {
        shipDatestamp: string;
        serviceType: string;
        packagingType: string;
        recipients: { address: Record<string, unknown> }[];
        shipper: { address: Record<string, unknown> };
        requestedPackageLineItems: {
          weight: { units: string; value: number };
          dimensions: { length: number; width: number; height: number; units: string };
        }[];
      };
    };
    expect(body.accountNumber.value).toBe('740561073');
    expect(body.labelResponseOptions).toBe('LABEL');
    expect(body.requestedShipment.shipDatestamp).toBe('2026-11-09');
    expect(body.requestedShipment.serviceType).toBe('FEDEX_INTERNATIONAL_PRIORITY');
    expect(body.requestedShipment.packagingType).toBe('YOUR_PACKAGING');
    expect(body.requestedShipment.shipper.address.stateOrProvinceCode).toBe('DC');
    expect(body.requestedShipment.recipients[0]?.address.stateOrProvinceCode).toBeUndefined();
    expect(body.requestedShipment.requestedPackageLineItems[0]).toEqual({
      weight: { units: 'KG', value: 1.24 },
      dimensions: { length: 31, width: 20, height: 10, units: 'CM' },
    });
  });

  it('maps a 400 with a documented error body to a sanitized rejection', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(
      json(400, {
        errors: [{ code: 'SHIPMENT.ACCOUNTNUMBER.INVALID', message: 'account 740561073 bad' }],
      }),
    );
    const error = await new FedexShipAdapter(auth(), fetcher, now)
      .create(input)
      .catch((caught: unknown): unknown => caught);
    expect(error).toBeInstanceOf(ShipmentProviderRejectedException);
    expect((error as ShipmentProviderRejectedException).code).toBe(
      'SHIPMENT.ACCOUNTNUMBER.INVALID',
    );
    expect(JSON.stringify(error)).not.toContain('740561073');
  });

  it('never trusts unsafe provider error codes', async (): Promise<void> => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json(422, { errors: [{ code: 'bad code <script>' }] }));
    await expect(new FedexShipAdapter(auth(), fetcher, now).create(input)).rejects.toMatchObject({
      code: 'PROVIDER_REJECTED',
    });
  });

  it('treats a 4xx without a definite error body as ambiguous', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(new Response('oops', { status: 400 }));
    await expect(new FedexShipAdapter(auth(), fetcher, now).create(input)).rejects.toBeInstanceOf(
      ShipmentProviderAmbiguousException,
    );
  });

  it('refreshes the token once and rejects a repeated 401 as authorization', async (): Promise<void> => {
    const tokens = auth();
    const fetcher = vi
      .fn()
      .mockImplementation(async (): Promise<Response> => new Response('', { status: 401 }));
    await expect(new FedexShipAdapter(tokens, fetcher, now).create(input)).rejects.toMatchObject({
      code: 'AUTHORIZATION',
    });
    expect(tokens.invalidate).toHaveBeenCalledWith('store');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects 403 as authorization', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
    await expect(new FedexShipAdapter(auth(), fetcher, now).create(input)).rejects.toMatchObject({
      code: 'AUTHORIZATION',
    });
  });

  it.each([429, 500, 503])(
    'treats %i after sending as ambiguous',
    async (status: number): Promise<void> => {
      const fetcher = vi.fn().mockResolvedValue(json(status, { errors: [{ code: 'X' }] }));
      await expect(new FedexShipAdapter(auth(), fetcher, now).create(input)).rejects.toBeInstanceOf(
        ShipmentProviderAmbiguousException,
      );
    },
  );

  it('treats a timeout or network failure as ambiguous', async (): Promise<void> => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    await expect(new FedexShipAdapter(auth(), fetcher, now).create(input)).rejects.toBeInstanceOf(
      ShipmentProviderAmbiguousException,
    );
  });

  it('treats a malformed success body as ambiguous', async (): Promise<void> => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        json(200, { output: { transactionShipments: [{ masterTrackingNumber: '1' }] } }),
      );
    await expect(new FedexShipAdapter(auth(), fetcher, now).create(input)).rejects.toBeInstanceOf(
      ShipmentProviderAmbiguousException,
    );
  });

  it('treats a non-PDF label as ambiguous', async (): Promise<void> => {
    const bad = structuredClone(success);
    bad.output.transactionShipments[0]!.pieceResponses[0]!.packageDocuments[0]!.encodedLabel =
      Buffer.from('not a pdf').toString('base64');
    const fetcher = vi.fn().mockResolvedValue(json(200, bad));
    await expect(new FedexShipAdapter(auth(), fetcher, now).create(input)).rejects.toBeInstanceOf(
      ShipmentProviderAmbiguousException,
    );
  });

  it('rejects before sending when credentials cannot produce a token', async (): Promise<void> => {
    const fetcher = vi.fn();
    const denied = tokenSource(
      vi
        .fn<(ref: string) => Promise<string>>()
        .mockRejectedValue(new TrackingAuthorizationException()),
    );
    await expect(new FedexShipAdapter(denied, fetcher, now).create(input)).rejects.toMatchObject({
      code: 'AUTHORIZATION',
    });
    const down = tokenSource(
      vi.fn<(ref: string) => Promise<string>>().mockRejectedValue(new FedexTransientException()),
    );
    await expect(new FedexShipAdapter(down, fetcher, now).create(input)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a recipient country that is not an ISO code without calling FedEx', async (): Promise<void> => {
    const fetcher = vi.fn();
    await expect(
      new FedexShipAdapter(auth(), fetcher, now).create({
        ...input,
        recipient: { ...input.recipient, country: 'Colombia' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RECIPIENT_COUNTRY' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never leaks the token or label bytes in errors', async (): Promise<void> => {
    const fetcher = vi.fn().mockRejectedValue(new Error('secret-token failure'));
    const error = await new FedexShipAdapter(auth(), fetcher, now)
      .create(input)
      .catch((caught: unknown): unknown => caught);
    expect(String((error as Error).message)).not.toContain('secret-token');
  });
});
