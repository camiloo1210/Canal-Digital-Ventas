import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import { DECIMAL_INPUT } from '@/lib/input-attributes';
import { ProductFormFields } from '@/features/products/components/product-form-fields';

vi.mock('@/features/products/actions/product-image-uploads.actions', (): object => ({
  createProductImageUploadsAction: vi.fn(),
}));

function inputTag(html: string, id: string): string {
  const match = new RegExp('<input[^>]*id="' + id + '"[^>]*>').exec(html);
  if (!match) throw new Error('input not found: ' + id);
  return match[0];
}

describe('product form numeric inputs', (): void => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="es" timeZone="America/Guayaquil" messages={es}>
      <ProductFormFields
        categories={[]}
        currency="USD"
        managed={false}
        revision={0}
        fieldErrors={{}}
        clearField={(): void => undefined}
      />
    </NextIntlClientProvider>,
  );
  it.each(['stock', 'wholesaleMinQuantity'])('%s only takes digits', (id): void => {
    const tag = inputTag(html, id);
    expect(tag).toContain('inputMode="numeric"');
    expect(tag).toContain('pattern="[0-9]*"');
    expect(tag).toContain('maxLength="9"');
  });
  it.each(['price', 'cost', 'wholesalePrice', 'weightKg', 'lengthCm', 'widthCm', 'heightCm'])(
    '%s only takes unsigned decimals',
    (id): void => {
      const tag = inputTag(html, id);
      expect(tag).toContain('inputMode="decimal"');
      expect(tag).toContain('maxLength="15"');
      expect(tag).toContain('pattern="' + DECIMAL_INPUT.pattern + '"');
    },
  );
});
