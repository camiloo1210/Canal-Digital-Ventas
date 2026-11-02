'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImageIcon, Star, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import {
  PRODUCT_IMAGE_MIME_EXTENSIONS,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
} from '@/features/products/schemas/product-form.schema';

interface ProductGalleryFieldProps {
  initialUrls: string[];
  error?: string;
  managed: boolean;
  clearField: (name: string) => void;
}

interface GalleryTile {
  key: string;
  url: string;
  kind: 'existing' | 'new';
}

export function ProductGalleryField({
  initialUrls,
  error,
  managed,
  clearField,
}: ProductGalleryFieldProps): React.JSX.Element {
  const t = useTranslations('CatalogForms');
  const [existing, setExisting] = useState<string[]>(initialUrls);
  const [previews, setPreviews] = useState<string[]>([]);
  const objectUrlsRef = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    (): (() => void) => (): void => {
      objectUrlsRef.current.forEach((url): void => URL.revokeObjectURL(url));
    },
    [],
  );

  const tiles: GalleryTile[] = [
    ...existing.map((url): GalleryTile => ({ key: 'e-' + url, url, kind: 'existing' })),
    ...previews.map((url): GalleryTile => ({ key: 'n-' + url, url, kind: 'new' })),
  ];
  const remainingSlots = Math.max(0, PRODUCT_IMAGE_MAX_COUNT - existing.length);

  const removeExisting = (url: string): void => {
    clearField('image');
    setExisting((current): string[] => current.filter((entry): boolean => entry !== url));
  };
  const makeCover = (url: string): void => {
    setExisting((current): string[] => [url, ...current.filter((entry): boolean => entry !== url)]);
  };

  return (
    <div className="space-y-4">
      {managed && <input type="hidden" name="galleryManaged" value="1" />}
      {existing.map((url): React.JSX.Element => (
        <input key={url} type="hidden" name="existingImages" value={url} />
      ))}
      {tiles.length > 0 ? (
        <ul aria-label={t('imageCurrent')} className="grid grid-cols-2 gap-3">
          {tiles.map((tile, index): React.JSX.Element => (
            <li
              key={tile.key}
              className="relative aspect-square overflow-hidden rounded-lg border bg-muted/30"
            >
              <Image
                src={tile.url}
                alt={t('imagePreview') + ' ' + (index + 1)}
                fill
                unoptimized
                sizes="128px"
                className="object-cover"
              />
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                  {t('imageCover')}
                </span>
              )}
              {tile.kind === 'existing' && (
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                  {index !== 0 ? (
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
                    aria-label={t('imageRemove', { n: index + 1 })}
                    onClick={(): void => removeExisting(tile.url)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex aspect-square w-full max-w-64 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          <ImageIcon aria-hidden="true" className="size-8" />
          {t('noImage')}
        </div>
      )}
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="image">
          {t('imageAddMore')}
          <span className="font-normal text-muted-foreground">{t('optional')}</span>
        </FieldLabel>
        <Input
          ref={inputRef}
          id="image"
          name="image"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="min-h-11 w-full min-w-0 scroll-mt-6 text-sm"
          aria-invalid={Boolean(error)}
          aria-describedby={'image-help' + (error ? ' image-error' : '')}
          onChange={(event): void => {
            clearField('image');
            objectUrlsRef.current.forEach((url): void => URL.revokeObjectURL(url));
            const files = Array.from(event.target.files ?? []).filter(
              (file): boolean =>
                Object.hasOwn(PRODUCT_IMAGE_MIME_EXTENSIONS, file.type) &&
                file.size <= PRODUCT_IMAGE_MAX_BYTES,
            );
            objectUrlsRef.current = files
              .slice(0, remainingSlots)
              .map((file): string => URL.createObjectURL(file));
            setPreviews(objectUrlsRef.current);
          }}
        />
        <FieldDescription id="image-help">
          {t('imageFormats')} {t('imageGalleryHelp')}
        </FieldDescription>
        {previews.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('imageNewSelected', { count: previews.length })}
          </p>
        )}
        {error && <FieldError id="image-error">{error}</FieldError>}
      </Field>
    </div>
  );
}
