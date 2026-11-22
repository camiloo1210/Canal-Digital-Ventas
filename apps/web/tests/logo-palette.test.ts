import { describe, expect, it } from 'vitest';
import { deriveLogoTheme } from '@/features/dashboard/utils/logo-palette';

function contrast(first: string, second: string): number {
  const luminance = (hex: string): number =>
    [0.2126, 0.7152, 0.0722].reduce((sum, weight, index): number => {
      const channel = Number.parseInt(hex.substring(1 + 2 * index, 3 + 2 * index), 16) / 255;
      const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      return sum + weight * linear;
    }, 0);
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('automatic dashboard colors from the logo', (): void => {
  it('keeps the blue fallback for transparent or grayscale logos and makes white marks visible', (): void => {
    expect(deriveLogoTheme(new Uint8ClampedArray([200, 0, 100, 0]))).toBeNull();
    expect(deriveLogoTheme(new Uint8ClampedArray([250, 250, 250, 255]))).toEqual({
      logoBackground: '#111827',
      palette: null,
    });
    expect(deriveLogoTheme(new Uint8ClampedArray([26, 26, 26, 255]))).toEqual({
      logoBackground: '#ffffff',
      palette: null,
    });
  });

  it('uses a colored mark even when its logo has a white background', (): void => {
    const red = [200, 34, 43, 255];
    const green = [38, 143, 38, 255];
    const paddedRed = [...Array<number>(80).fill(255), ...red, 0, 255, 255, 0];
    const theme = deriveLogoTheme(new Uint8ClampedArray(paddedRed));
    expect(theme?.palette).not.toBeNull();
    expect(theme?.palette).toEqual(deriveLogoTheme(new Uint8ClampedArray(red))?.palette);
    expect(theme?.palette).not.toEqual(deriveLogoTheme(new Uint8ClampedArray(green))?.palette);
  });

  it.each([
    [255, 235, 0],
    [255, 55, 0],
    [0, 185, 130],
    [20, 37, 215],
    [167, 40, 219],
  ])('preserves text contrast in both modes for %i %i %i', (r, g, b): void => {
    const palette = deriveLogoTheme(new Uint8ClampedArray([r, g, b, 255]))?.palette;
    expect(palette).toBeDefined();
    expect(palette).not.toBeNull();
    for (const colors of Object.values(palette!)) {
      expect(contrast(colors.primary, colors['primary-foreground'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.primary, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.accent, colors['accent-foreground'])).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(colors['sidebar-primary'], colors['sidebar-primary-foreground']),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors['sidebar-accent'], '#e0e7f2')).toBeGreaterThanOrEqual(4.5);
    }
  });
});
