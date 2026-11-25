export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const HEADER_BYTES = 12;

function startsWith(data: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index): boolean => data[offset + index] === value);
}

/**
 * Identifies JPEG, PNG and WebP from the file's first bytes. The browser's `file.type` comes from
 * the extension, so a renamed executable would otherwise pass as an image.
 */
export function detectImageMime(header: Uint8Array): AllowedImageMime | null {
  if (startsWith(header, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP: "RIFF" + 4 size bytes + "WEBP".
  if (
    startsWith(header, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(header, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'image/webp';
  return null;
}

/** Reads only the header of a file and returns its real image type, or null if it is not one. */
export async function sniffImageFile(file: Blob): Promise<AllowedImageMime | null> {
  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  return detectImageMime(header);
}
