import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import es from '@/messages/es.json';
import { ProductImageCarousel } from '@/features/store/components/product-image-carousel';

function render(images: string[]): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="es" timeZone="America/Guayaquil" messages={es}>
      <ProductImageCarousel images={images} alt="Camisa" />
    </NextIntlClientProvider>,
  );
}

describe('product image carousel', (): void => {
  it('shows the fallback when the product has no images', (): void => {
    const html = render([]);
    expect(html).toContain(es.Storefront.noImage);
    expect(html).not.toContain('aria-roledescription="carousel"');
  });
  it('renders one image without controls', (): void => {
    const html = render(['https://example.test/a.png']);
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).not.toContain(es.Storefront.galleryNext);
  });
  it('renders slides, accessible controls and thumbnails for several images', (): void => {
    const html = render(['https://example.test/a.png', 'https://example.test/b.png']);
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(2);
    expect(html).toContain(`aria-label="${es.Storefront.galleryPrev}"`);
    expect(html).toContain(`aria-label="${es.Storefront.galleryNext}"`);
    expect(html).toContain('Imagen 1 de 2');
    expect(html).toContain('Ir a la imagen 2');
  });
});
