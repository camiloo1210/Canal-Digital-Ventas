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

describe('product image empty state', (): void => {
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
  const dropzone = /<button[^>]*data-dropzone="product-images"[^>]*>([\s\S]*?)<\/button>/.exec(
    html,
  );

  it('is a real button, so clicking "Aún no hay imagen" can open the file picker', (): void => {
    expect(dropzone).not.toBeNull();
    expect(dropzone?.[0]).toContain('type="button"');
    expect(dropzone?.[1]).toContain(es.CatalogForms.noImage);
  });
  it('tells the user they can click or drop images', (): void => {
    expect(dropzone?.[1]).toContain(es.CatalogForms.imageDropHint);
  });
  it('keeps the file input restricted to the supported formats', (): void => {
    expect(inputTag(html, 'image')).toContain('accept="image/jpeg,image/png,image/webp"');
  });
});

describe('product image previews', (): void => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="es" timeZone="America/Guayaquil" messages={es}>
      <ProductFormFields
        categories={[]}
        currency="USD"
        managed
        revision={0}
        fieldErrors={{}}
        clearField={(): void => undefined}
        galleryUrls={['https://cdn.example.test/a.jpg', 'https://cdn.example.test/b.jpg']}
      />
    </NextIntlClientProvider>,
  );
  const tiles = [...html.matchAll(/<li[^>]*class="([^"]*aspect-[^"]*)"/g)].map(
    (match): string => match[1],
  );

  it('shows the cover as a large preview spanning the whole row', (): void => {
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toContain('col-span-2');
    expect(tiles[0]).toContain('aspect-[4/3]');
  });
  it('shows the other images as thumbnails big enough to inspect', (): void => {
    expect(tiles[1]).not.toContain('col-span-2');
    expect(html).not.toContain('sm:grid-cols-4');
  });
  it('does not shrink the preview to a 128px source hint', (): void => {
    expect(html).not.toContain('sizes="128px"');
  });
});
