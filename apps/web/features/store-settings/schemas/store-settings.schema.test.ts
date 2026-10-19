import { describe, expect, it } from 'vitest';
import { isValidBrandingImage } from '@/features/store-settings/schemas/store-settings.schema';

describe('store branding uploads', (): void => {
  it('rejects disguised SVG or HTML even with an allowed MIME type', async (): Promise<void> => {
    expect(
      await isValidBrandingImage(
        new File(['<svg onload="alert(1)"></svg>'], 'logo.png', { type: 'image/png' }),
      ),
    ).toBe(false);
  });
  it('rejects files exceeding the upload limit', async (): Promise<void> => {
    expect(
      await isValidBrandingImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }),
      ),
    ).toBe(false);
  });
  it('accepts the supported image signatures', async (): Promise<void> => {
    expect(
      await isValidBrandingImage(
        new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'logo.png', {
          type: 'image/png',
        }),
      ),
    ).toBe(true);
    expect(
      await isValidBrandingImage(
        new File([new Uint8Array([255, 216, 255])], 'logo.jpg', { type: 'image/jpeg' }),
      ),
    ).toBe(true);
    expect(
      await isValidBrandingImage(new File(['RIFF0000WEBP'], 'logo.webp', { type: 'image/webp' })),
    ).toBe(true);
  });
});
