import { z } from 'zod';
import {
  decodeKiviTokenEncryptionKey,
  verifyKiviOrderLookupSignature,
} from '@canaldigital/packages/core';
import { getKiviOrderLookupReadRepository } from '@/features/kivi/di/kivi.di';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 2048;
const HEADERS = { 'Cache-Control': 'no-store' } as const;

const BodySchema = z.object({
  tenantId: z.string().uuid(),
  // Null when the asker is not verified: only an unguessable order reference is then accepted.
  phone: z
    .string()
    .regex(/^[1-9][0-9]{7,14}$/)
    .nullable(),
  orderNumber: z
    .string()
    .max(100)
    .refine((value: string): boolean => !/[\u0000-\u001f\u007f]/.test(value))
    .nullable(),
});

function json(body: object, status: number): Response {
  return Response.json(body, { status, headers: HEADERS });
}

function tenantIdOf(raw: string): string | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const id: unknown = (value as Record<string, unknown>).tenantId;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const masterKey = decodeKiviTokenEncryptionKey(process.env.KIVI_TOKEN_ENCRYPTION_KEY);
  if (masterKey === null) return json({ error: 'unavailable' }, 503);
  try {
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return json({ error: 'payload_too_large' }, 413);
    }
    const timestamp = request.headers.get('X-Kivi-Timestamp');
    const signature = request.headers.get('X-Kivi-Signature');
    const tenantId = tenantIdOf(rawBody);
    if (
      !timestamp ||
      !signature ||
      !tenantId ||
      !verifyKiviOrderLookupSignature({
        masterKey,
        tenantId,
        timestamp,
        rawBody,
        signature,
        nowSeconds: Math.floor(Date.now() / 1000),
      })
    ) {
      return json({ error: 'unauthorized' }, 401);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: 'invalid_request' }, 400);
    }
    const parsed = BodySchema.safeParse(payload);
    if (!parsed.success) return json({ error: 'invalid_request' }, 400);
    const orders = await getKiviOrderLookupReadRepository().findLatestOrders(parsed.data);
    return json({ orders }, 200);
  } catch (error: unknown) {
    console.error('[Kivi] order lookup failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'unavailable' }, 500);
  }
}
