import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import { ProductFormFields } from '@/features/products/components/product-form-fields';
import { CategoryFormFields } from '@/features/categories/components/category-form-fields';
import { CatalogFormFeedback } from '@/features/dashboard/components/catalog-form-feedback';

function render(children: React.ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="es" timeZone="America/Guayaquil" messages={es}>
      {children}
    </NextIntlClientProvider>,
  );
}

describe('catalog form accessibility', (): void => {
  it('renders English form guidance and accessible errors from the English catalog', (): void => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="America/Guayaquil" messages={en}>
        <ProductFormFields
          categories={[]}
          currency="USD"
          defaultValues={{ wholesaleMinQuantity: '37' }}
          fieldErrors={{ price: [en.CatalogForms.moneyFormat] }}
          revision={1}
          clearField={(): void => undefined}
        />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(en.CatalogForms.moneyFormat);
    expect(html).toContain('value="37"');
    expect(html).toContain('id="price-error"');
    expect(html).not.toContain('MISSING_MESSAGE');
  });
  it('retains the wholesale minimum and connects syntax errors to their inputs', (): void => {
    const html = render(
      <ProductFormFields
        categories={[]}
        currency="EUR"
        defaultValues={{ wholesaleMinQuantity: '37', sku: 'ABC123', price: '12abc' }}
        fieldErrors={{ price: ['Importe inválido'], image: ['Imagen inválida'] }}
        revision={1}
        clearField={(): void => undefined}
      />,
    );
    expect(html).toContain('name="wholesaleMinQuantity"');
    expect(html).toContain('value="37"');
    expect(html).toContain('aria-describedby="price-help price-error"');
    expect(html).toContain('id="price-error"');
    expect(html).toContain('aria-describedby="image-help image-error"');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).not.toContain('SVG');
    expect(html).toContain('EUR');
    expect(html).toContain('value="ABC123"');
  });
  it('connects category field errors while retaining rejected descriptions', (): void => {
    const html = render(
      <CategoryFormFields
        revision={1}
        fieldErrors={{ name: ['Nombre requerido'] }}
        defaultValues={{ name: '', description: 'Conservar descripción' }}
        clearField={(): void => undefined}
      />,
    );
    expect(html).toContain('name-help name-error');
    expect(html).toContain('id="name-error"');
    expect(html).toContain('Conservar descripción');
  });
  it('provides a focusable error summary with links to each field', (): void => {
    const html = render(
      <CatalogFormFeedback
        revision={1}
        error="Revisa los datos"
        fieldErrors={{ wholesaleMinQuantity: ['Mínimo requerido'] }}
        labels={{ wholesaleMinQuantity: 'Mínimo mayorista' }}
      />,
    );
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="#wholesaleMinQuantity"');
    expect(html).toContain('Mínimo mayorista');
  });
});
