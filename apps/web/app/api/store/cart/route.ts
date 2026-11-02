import { cartDi } from '@/features/cart/di/cart.di';
import { CartQuerySchema } from '@/features/cart/schemas/cart-api.schema';
import {
  authenticateCartRequest,
  cartJson,
  mapCartError,
} from '@/features/cart/server/cart-route.guard';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await authenticateCartRequest(request);
    if ('response' in auth) return auth.response;
    const parsed = CartQuerySchema.safeParse({
      tenant: new URL(request.url).searchParams.get('tenant'),
    });
    if (!parsed.success) return cartJson({ error: 'invalid_request' }, 400);
    const cart = await cartDi.resolveGetBuyerCartUseCase().execute({
      userId: auth.userId,
      tenantSlug: parsed.data.tenant,
    });
    return cartJson({ cart }, 200);
  } catch (error: unknown) {
    return mapCartError(error);
  }
}
