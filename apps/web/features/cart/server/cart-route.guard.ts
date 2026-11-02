import { createClient } from '@/lib/supabase/server';
import { CART_MAX_BODY_BYTES } from '@/features/cart/schemas/cart-api.schema';
import type { CartApiCart } from '@/features/cart/types/cart-api.types';

export const CART_HEADERS = { 'Cache-Control': 'no-store' } as const;

export function cartJson(body: object, status: number): Response {
  return Response.json(body, { status, headers: CART_HEADERS });
}

function isSameOrigin(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null) return fetchSite === 'same-origin';
  const origin = request.headers.get('origin');
  if (origin === null || host === null) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Origin check, then session. Returns the authenticated user id or an error response. */
export async function authenticateCartRequest(
  request: Request,
): Promise<{ userId: string } | { response: Response }> {
  if (!isSameOrigin(request)) return { response: cartJson({ error: 'forbidden' }, 403) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: cartJson({ error: 'unauthorized' }, 401) };
  return { userId: user.id };
}

/** Reads at most CART_MAX_BODY_BYTES actual bytes and parses them as JSON regardless of content-type. */
export async function readCartJsonBody(
  request: Request,
): Promise<{ body: unknown } | { response: Response }> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > CART_MAX_BODY_BYTES) {
    return { response: cartJson({ error: 'payload_too_large' }, 413) };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > CART_MAX_BODY_BYTES) {
        await reader.cancel();
        return { response: cartJson({ error: 'payload_too_large' }, 413) };
      }
      chunks.push(value);
    }
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { response: cartJson({ error: 'invalid_request' }, 400) };
  }
}

export function mapCartError(error: unknown): Response {
  const name = error instanceof Error ? error.name : 'unknown';
  if (name === 'CartVersionConflictException') {
    const serverCart = (error as { serverCart?: CartApiCart }).serverCart;
    return cartJson({ error: 'conflict', cart: serverCart ?? null }, 409);
  }
  if (name === 'BuyerCartStoreNotFoundException' || name === 'StoreNotFoundForCartException')
    return cartJson({ error: 'not_found' }, 404);
  console.error('[Cart] request failed', name);
  return cartJson({ error: 'unavailable' }, 500);
}
