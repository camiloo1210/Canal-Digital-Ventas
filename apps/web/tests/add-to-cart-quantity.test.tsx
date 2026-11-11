import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button';
import { useCartStore } from '@/features/cart/store/cart.store';

vi.mock('@/features/cart/store/cart.store', async (importOriginal): Promise<object> => {
  const actual = await importOriginal<typeof import('@/features/cart/store/cart.store')>();
  return {
    ...actual,
    useCartStore: Object.assign(
      (): ReturnType<typeof actual.useCartStore.getState> => actual.useCartStore.getState(),
      actual.useCartStore,
    ),
  };
});

const product = {
  productId: 'product',
  name: 'Product',
  retailPriceCents: 1500,
  currency: 'USD',
  wholesalePriceCents: 1000,
  wholesaleMinQuantity: 5,
  inStock: true,
  maxQuantity: 10,
  showExactStock: true,
  hasVariants: false,
  tenantSlug: 'shop',
};

function render(): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="es" messages={es} timeZone="America/Guayaquil">
      <AddToCartButton {...product} />
    </NextIntlClientProvider>,
  );
}

beforeEach((): void => {
  useCartStore.setState({ tenantSlug: null, items: [] });
});

describe('product quantity selector', (): void => {
  it('provides a labelled numeric input with quantity buttons', (): void => {
    const html = render();
    expect(html).toContain('Cantidad');
    expect(html).toContain('type="number"');
    expect(html).toContain('max="10"');
    expect(html).toContain('Reducir cantidad');
    expect(html).toContain('Aumentar cantidad');
  });
  it('limits additions to the units left after those already in the cart', (): void => {
    useCartStore.getState().addItem({ ...product, quantity: 7, unitPriceCents: 1000 }, 'shop');
    expect(render()).toContain('max="3"');
  });
  it('disables adding when the cart already has the available units', (): void => {
    useCartStore.getState().addItem({ ...product, quantity: 10, unitPriceCents: 1000 }, 'shop');
    const html = render();
    expect(html).toContain('Máximo disponible');
    expect(html).toContain('Ya tienes en el carrito todas las unidades disponibles');
  });
});
