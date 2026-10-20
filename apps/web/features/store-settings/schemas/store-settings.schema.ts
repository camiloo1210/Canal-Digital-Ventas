import { z } from 'zod';

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(3).max(100),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(255),
  version: z
    .string()
    .regex(/^\d+$/)
    .transform((value: string): number => Number(value))
    .pipe(z.number().int().nonnegative()),
  removeLogo: z.boolean(),
  removeBanner: z.boolean(),
});

const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export type BrandingMime = keyof typeof extensions;

export function imageExtension(mime: BrandingMime): string {
  return extensions[mime];
}

export async function isValidBrandingImage(file: File): Promise<boolean> {
  if (file.size > 5 * 1024 * 1024 || !(file.type in extensions)) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value: number, index: number): boolean => bytes[index] === value,
    );
  return (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  );
}
