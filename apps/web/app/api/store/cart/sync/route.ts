import { cartDi } from '@/features/cart/di/cart.di';
import { CartSyncBodySchema } from '@/features/cart/schemas/cart-api.schema';
import {
  authenticateCartRequest,
  cartJson,
  mapCartError,
  readCartJsonBody,
} from '@/features/cart/server/cart-route.guard';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await authenticateCartRequest(request);
    if ('response' in auth) return auth.response;
    const raw = await readCartJsonBody(request);
    if ('response' in raw) return raw.response;
    const parsed = CartSyncBodySchema.safeParse(raw.body);
    if (!parsed.success) return cartJson({ error: 'invalid_request' }, 400);
    const result = await cartDi.resolveSyncBuyerCartUseCase().execute({
      userId: auth.userId,
      tenantSlug: parsed.data.tenant,
      items: parsed.data.items,
      baseVersion: parsed.data.baseVersion,
    });
    return cartJson({ cart: result.cart, dropped: result.dropped }, 200);
  } catch (error: unknown) {
    return mapCartError(error);
  }
}
