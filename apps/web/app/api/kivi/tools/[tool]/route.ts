import { z } from 'zod';
import {
  GET_PRODUCT_DETAILS_TOOL,
  decodeKiviTokenEncryptionKey,
  verifyKiviToolsSignature,
} from '@canaldigital/packages/core';
import { getKiviProductLookupReadRepository } from '@/features/kivi/di/kivi.di';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 4096;
const HEADERS = { 'Cache-Control': 'no-store' } as const;

const EnvelopeSchema = z.object({
  tenantId: z.string().uuid(),
  tool: z.string().optional(),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

const noControlChars = (value: string): boolean => !/[\u0000-\u001f\u007f]/.test(value);

const ProductDetailsArgsSchema = z.object({
  query: z.string().trim().min(1).max(100).refine(noControlChars),
});

interface RouteContext {
  params: Promise<{ tool: string }>;
}

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

export async function POST(request: Request, context: RouteContext): Promise<Response> {
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
      !verifyKiviToolsSignature({
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

    // Authenticated from here on: dispatch by tool name.
    const { tool } = await context.params;
    if (tool !== GET_PRODUCT_DETAILS_TOOL) return json({ error: 'unknown_tool' }, 404);

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: 'invalid_request' }, 400);
    }
    const envelope = EnvelopeSchema.safeParse(payload);
    if (!envelope.success || (envelope.data.tool !== undefined && envelope.data.tool !== tool)) {
      return json({ error: 'invalid_request' }, 400);
    }
    const args = ProductDetailsArgsSchema.safeParse(envelope.data.arguments);
    if (!args.success) return json({ error: 'invalid_request' }, 400);

    const products = await getKiviProductLookupReadRepository().findProducts({
      tenantId: envelope.data.tenantId,
      query: args.data.query,
    });
    return json({ products }, 200);
  } catch (error: unknown) {
    console.error('[Kivi] tool call failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'unavailable' }, 500);
  }
}
