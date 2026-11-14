import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import { ProductFormFields } from '@/features/products/components/product-form-fields';
import { PRODUCT_FORM_SECTIONS } from '@/features/products/components/product-form-sections';

vi.mock('@/features/products/actions/product-image-uploads.actions', (): object => ({
  createProductImageUploadsAction: vi.fn(),
}));

describe('product form sections', (): void => {
  it('gives every navigable section a matching anchor in the form', (): void => {
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
    for (const section of PRODUCT_FORM_SECTIONS)
      expect(html, section.id).toContain('id="' + section.id + '"');
  });

  it('translates every section label in both locales', (): void => {
    for (const messages of [es, en])
      for (const section of PRODUCT_FORM_SECTIONS)
        expect(
          (messages.CatalogForms as Record<string, string>)[section.labelKey],
          section.labelKey,
        ).toBeTruthy();
  });
});
