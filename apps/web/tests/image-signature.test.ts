import { describe, expect, it } from 'vitest';
import { detectImageMime, sniffImageFile } from '@/features/products/utils/image-signature';

const bytes = (...values: number[]): Uint8Array<ArrayBuffer> => Uint8Array.from(values);
const ascii = (text: string): number[] =>
  Array.from(text).map((char): number => char.charCodeAt(0));

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1);
const WEBP = bytes(...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBP'));
const EXE = bytes(...ascii('MZ'), 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0);
const GIF = bytes(...ascii('GIF89a'), 1, 0, 1, 0, 0, 0);
const SVG = bytes(...ascii('<svg xmlns="http'));
const PDF = bytes(...ascii('%PDF-1.7'), 0, 0, 0, 0);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0);

describe('detectImageMime', (): void => {
  it('recognises the three allowed formats by their signature', (): void => {
    expect(detectImageMime(PNG)).toBe('image/png');
    expect(detectImageMime(JPEG)).toBe('image/jpeg');
    expect(detectImageMime(WEBP)).toBe('image/webp');
  });
  it.each([
    ['an executable', EXE],
    ['a GIF', GIF],
    ['an SVG', SVG],
    ['a PDF', PDF],
    ['a ZIP', ZIP],
    ['an empty file', bytes()],
    ['a truncated header', bytes(0x89, 0x50)],
    ['a RIFF that is not WebP', bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE'))],
  ])('rejects %s', (_label, data): void => {
    expect(detectImageMime(data)).toBeNull();
  });
});

describe('sniffImageFile', (): void => {
  it('trusts the content, not the file name or the declared type', async (): Promise<void> => {
    const disguised = new File([EXE], 'foto.png', { type: 'image/png' });
    expect(await sniffImageFile(disguised)).toBeNull();
    const exe = new File([EXE], 'setup.exe', { type: 'application/x-msdownload' });
    expect(await sniffImageFile(exe)).toBeNull();
  });
  it('accepts a real image even with a wrong or missing extension and type', async (): Promise<void> => {
    const noExtension = new File([PNG], 'foto', { type: '' });
    expect(await sniffImageFile(noExtension)).toBe('image/png');
    const wrongType = new File([JPEG], 'foto.png', { type: 'image/png' });
    expect(await sniffImageFile(wrongType)).toBe('image/jpeg');
  });
});
