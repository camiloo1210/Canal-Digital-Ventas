'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImageIcon, RotateCcw, Star, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { useTenantId } from '@/features/dashboard/components/tenant-scope';
import { createClient } from '@/lib/supabase/client';
import { createProductImageUploadsAction } from '@/features/products/actions/product-image-uploads.actions';
import {
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_MIME_EXTENSIONS,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
} from '@/features/products/schemas/product-form.schema';
import {
  IMAGE_UPLOAD_CONCURRENCY,
  uploadBatch,
  type UploadFailure,
  type UploadOutcome,
} from '@/features/products/utils/image-upload-queue';
import { compressImageInBrowser } from '@/features/products/utils/compress-image';
import { sniffImageFile } from '@/features/products/utils/image-signature';
import { cn } from '@/lib/utils';

const PRODUCT_IMAGE_MAX_SOURCE_BYTES = 30 * 1024 * 1024;

interface ProductGalleryFieldProps {
  initialUrls: string[];
  error?: string;
  managed: boolean;
  clearField: (name: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

interface GalleryTile {
  key: string;
  id: string;
  url: string;
  kind: 'existing' | 'new';
}

interface PendingImage {
  id: string;
  file: File;
  url: string;
  status: 'uploading' | 'done' | 'error';
  path: string | null;
  failure: UploadFailure | null;
}

/**
 * Accepts a file only if its bytes are a JPEG, PNG or WebP and it is not oversized. The name and
 * the browser-declared type are ignored (both come from the extension), and the returned file
 * carries the real type so the upload's Content-Type matches the content.
 */
async function toAcceptableImage(file: File): Promise<File | null> {
  if (file.size > PRODUCT_IMAGE_MAX_SOURCE_BYTES) return null;
  const mime = await sniffImageFile(file);
  if (!mime || !Object.hasOwn(PRODUCT_IMAGE_MIME_EXTENSIONS, mime)) return null;
  return mime === file.type
    ? file
    : new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

function fingerprint(file: File): string {
  return [file.name, file.size, file.lastModified].join(':');
}

export function ProductGalleryField({
  initialUrls,
  error,
  managed,
  clearField,
  onUploadingChange,
}: ProductGalleryFieldProps): React.JSX.Element {
  const t = useTranslations('CatalogForms');
  const tenantId = useTenantId();
  const [existing, setExisting] = useState<string[]>(initialUrls);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [limitHit, setLimitHit] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pendingRef = useRef<PendingImage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    (): (() => void) => (): void => {
      pendingRef.current.forEach((entry): void => URL.revokeObjectURL(entry.url));
    },
    [],
  );

  const tiles: GalleryTile[] = [
    ...existing.map((url): GalleryTile => ({ key: 'e-' + url, id: url, url, kind: 'existing' })),
    ...pending.map((entry): GalleryTile => ({
      key: 'n-' + entry.id,
      id: entry.id,
      url: entry.url,
      kind: 'new',
    })),
  ];
  const remainingSlots = Math.max(0, PRODUCT_IMAGE_MAX_COUNT - existing.length);

  const commitPending = (next: PendingImage[]): void => {
    pendingRef.current = next;
    setPending(next);
    onUploadingChange?.(next.some((entry): boolean => entry.status === 'uploading'));
  };

  const patchPending = (id: string, patch: Partial<PendingImage>): void => {
    if (!pendingRef.current.some((entry): boolean => entry.id === id)) return;
    commitPending(
      pendingRef.current.map((entry): PendingImage =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const startUploads = (batch: PendingImage[]): void => {
    void uploadBatch(
      batch.map((entry): File => entry.file),
      {
        prepare: compressImageInBrowser,
        requestSlots: async (contentTypes): Promise<{ path: string; token: string }[] | null> => {
          const result = await createProductImageUploadsAction({ contentTypes, tenantId });
          return result.success ? result.uploads : null;
        },
        put: async (slot, file): Promise<boolean> => {
          const { error: uploadError } = await createClient()
            .storage.from(PRODUCT_IMAGE_BUCKET)
            .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });
          return !uploadError;
        },
      },
      {
        concurrency: IMAGE_UPLOAD_CONCURRENCY,
        maxBytes: PRODUCT_IMAGE_MAX_BYTES,
        onOutcome: (index: number, outcome: UploadOutcome<File>): void => {
          const id = batch[index].id;
          if (outcome.status === 'done') {
            patchPending(id, { status: 'done', path: outcome.path, file: outcome.file });
          } else {
            patchPending(id, { status: 'error', failure: outcome.reason, file: outcome.file });
          }
        },
      },
    );
  };

  const addFiles = async (incoming: File[]): Promise<void> => {
    const checked = await Promise.all(incoming.map(toAcceptableImage));
    const valid = checked.filter((file): file is File => file !== null);
    // Read the queue only after the async checks, so concurrent selections cannot overbook it.
    const known = new Set(pendingRef.current.map((entry): string => fingerprint(entry.file)));
    const fresh = valid.filter((file): boolean => !known.has(fingerprint(file)));
    const room = Math.max(0, remainingSlots - pendingRef.current.length);
    const accepted = fresh.slice(0, room).map((file): PendingImage => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      status: 'uploading',
      path: null,
      failure: null,
    }));
    setRejectedCount(incoming.length - valid.length);
    setLimitHit(fresh.length > room);
    commitPending([...pendingRef.current, ...accepted]);
    if (accepted.length > 0) startUploads(accepted);
  };

  const retryPending = (id: string): void => {
    const target = pendingRef.current.find((entry): boolean => entry.id === id);
    if (!target) return;
    const restarted: PendingImage = { ...target, status: 'uploading', failure: null };
    commitPending(
      pendingRef.current.map((entry): PendingImage => (entry.id === id ? restarted : entry)),
    );
    startUploads([restarted]);
  };

  const removePending = (id: string): void => {
    clearField('image');
    const target = pendingRef.current.find((entry): boolean => entry.id === id);
    if (target) URL.revokeObjectURL(target.url);
    setLimitHit(false);
    commitPending(pendingRef.current.filter((entry): boolean => entry.id !== id));
  };
  const pendingById = new Map(pending.map((entry): [string, PendingImage] => [entry.id, entry]));
  const statusText = (entry: PendingImage | undefined): string => {
    if (!entry) return '';
    if (entry.status === 'uploading') return t('imageUploading');
    if (entry.status === 'done') return t('imageUploaded');
    return entry.failure === 'tooLargeAfterCompression'
      ? t('tooLargeAfterCompression')
      : t('imageUploadFailed');
  };
  const removeExisting = (url: string): void => {
    clearField('image');
    setLimitHit(false);
    setExisting((current): string[] => current.filter((entry): boolean => entry !== url));
  };
  const makeCover = (url: string): void => {
    setExisting((current): string[] => [url, ...current.filter((entry): boolean => entry !== url)]);
  };

  const dropFiles = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      className="space-y-4"
      onDragOver={(event): void => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event): void => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={dropFiles}
    >
      {managed && <input type="hidden" name="galleryManaged" value="1" />}
      {existing.map((url): React.JSX.Element => (
        <input key={url} type="hidden" name="existingImages" value={url} />
      ))}
      {pending.map((entry): React.JSX.Element | null =>
        entry.status === 'done' && entry.path ? (
          <input key={entry.id} type="hidden" name="uploadedImagePaths" value={entry.path} />
        ) : null,
      )}
      {tiles.length > 0 ? (
        <ul aria-label={t('imageCurrent')} className="mx-auto grid max-w-xl grid-cols-2 gap-3">
          {tiles.map((tile, index): React.JSX.Element => (
            <li
              key={tile.key}
              className={cn(
                'relative overflow-hidden rounded-xl border bg-muted/30',
                index === 0 ? 'col-span-2 aspect-[4/3]' : 'aspect-square',
              )}
            >
              <Image
                src={tile.url}
                alt={t('imagePreview') + ' ' + (index + 1)}
                fill
                unoptimized
                sizes={
                  index === 0
                    ? '(min-width: 1280px) 26rem, 36rem'
                    : '(min-width: 1280px) 13rem, 18rem'
                }
                className={index === 0 ? 'object-contain' : 'object-cover'}
              />
              <div className="absolute left-1.5 top-1.5 flex gap-1">
                {index === 0 && (
                  <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                    {t('imageCover')}
                  </span>
                )}
                {tile.kind === 'new' && (
                  <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {t('imageNewBadge')}
                  </span>
                )}
              </div>
              {tile.kind === 'new' && (
                <span
                  role="status"
                  className="absolute inset-x-1.5 top-9 rounded-md bg-background/90 px-1.5 py-0.5 text-xs"
                >
                  {statusText(pendingById.get(tile.id))}
                </span>
              )}
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                {tile.kind === 'new' && pendingById.get(tile.id)?.failure === 'uploadFailed' ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-11"
                    aria-label={t('imageRetry', { n: index + 1 })}
                    onClick={(): void => retryPending(tile.id)}
                  >
                    <RotateCcw aria-hidden="true" />
                  </Button>
                ) : tile.kind === 'existing' && index !== 0 ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-11"
                    aria-label={t('imageMakeCover', { n: index + 1 })}
                    onClick={(): void => makeCover(tile.url)}
                  >
                    <Star aria-hidden="true" />
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="size-11"
                  aria-label={
                    tile.kind === 'existing'
                      ? t('imageRemove', { n: index + 1 })
                      : t('imageRemoveNew', { n: index + 1 })
                  }
                  onClick={(): void => {
                    if (tile.kind === 'existing') removeExisting(tile.id);
                    else removePending(tile.id);
                  }}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          data-dropzone="product-images"
          onClick={(): void => inputRef.current?.click()}
          className={cn(
            'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground transition-colors duration-200 hover:border-primary/60 hover:bg-accent/40 motion-reduce:transition-none',
            dragging && 'border-primary bg-accent/60',
          )}
        >
          <ImageIcon aria-hidden="true" className="size-8" />
          <span className="font-medium text-foreground">{t('noImage')}</span>
          <span className="text-xs">{t('imageDropHint')}</span>
        </button>
      )}
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="image">
          {t('imageAddMore')}
          <span className="font-normal text-muted-foreground">{t('optional')}</span>
        </FieldLabel>
        <Input
          ref={inputRef}
          id="image"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="min-h-11 w-full min-w-0 scroll-mt-6 text-sm"
          aria-invalid={Boolean(error)}
          aria-describedby={'image-help' + (error ? ' image-error' : '')}
          onChange={(event): void => {
            clearField('image');
            const selected = Array.from(event.target.files ?? []);
            event.target.value = '';
            void addFiles(selected);
          }}
        />
        <FieldDescription id="image-help">
          {t('imageFormats')} {t('imageGalleryHelp')}
        </FieldDescription>
        {pending.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('imageNewSelected', { count: pending.length })}
          </p>
        )}
        {(rejectedCount > 0 || limitHit) && (
          <p role="status" className="text-xs text-destructive">
            {rejectedCount > 0 && t('imageRejected', { count: rejectedCount })}{' '}
            {limitHit && t('imageLimitReached', { max: PRODUCT_IMAGE_MAX_COUNT })}
          </p>
        )}
        {error && <FieldError id="image-error">{error}</FieldError>}
      </Field>
    </div>
  );
}
