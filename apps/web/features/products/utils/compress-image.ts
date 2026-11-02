import { planCompression } from '@/features/products/utils/image-upload-queue';

/** Downscales and re-encodes big images in the browser; null keeps the original. */
export async function compressImageInBrowser(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const plan = planCompression({ size: file.size, width: bitmap.width, height: bitmap.height });
    if (!plan.compress) {
      bitmap.close();
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0, plan.width, plan.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve): void => {
      canvas.toBlob(resolve, 'image/webp', 0.85);
    });
    if (!blob || blob.type !== 'image/webp') return null;
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], base + '.webp', { type: 'image/webp' });
  } catch {
    return null;
  }
}
