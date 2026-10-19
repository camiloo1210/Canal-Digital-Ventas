'use client';

import { useActionState, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { TenantBrandingReadModel } from '@canaldigital/packages/core';
import {
  updateStoreSettingsAction,
  type StoreSettingsState,
} from '@/features/store-settings/actions/store-settings.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SelectedImage {
  file: File;
  url: string;
}

function useSelectedImage(): [SelectedImage | null, (file: File | null) => void] {
  const [selection, setSelection] = useState<SelectedImage | null>(null);
  useEffect(
    (): (() => void) => (): void => {
      if (selection) URL.revokeObjectURL(selection.url);
    },
    [selection],
  );
  return [
    selection,
    (file: File | null): void => {
      setSelection(file ? { file, url: URL.createObjectURL(file) } : null);
    },
  ];
}

function ImagePreview({
  file,
  savedUrl,
  alt,
  className,
}: {
  file: SelectedImage | null;
  savedUrl: string | null;
  alt: string;
  className: string;
}): React.JSX.Element | null {
  const src = file?.url ?? savedUrl;
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized={Boolean(file)}
      className={className}
      sizes="(max-width: 768px) 100vw, 800px"
    />
  );
}

export function StoreSettingsForm({
  initial,
}: {
  initial: TenantBrandingReadModel;
}): React.JSX.Element {
  const t = useTranslations('StoreSettings');
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [description, setDescription] = useState(initial.description);
  const [logo, setLogo] = useSelectedImage();
  const [banner, setBanner] = useSelectedImage();
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [edited, setEdited] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: StoreSettingsState, formData: FormData): Promise<StoreSettingsState> => {
      if (logo) formData.set('logo', logo.file);
      if (banner) formData.set('banner', banner.file);
      const result = await updateStoreSettingsAction(previous, formData);
      setEdited(false);
      if (result.success) {
        setLogo(null);
        setBanner(null);
        setRemoveLogo(false);
        setRemoveBanner(false);
      }
      return result;
    },
    { success: false, message: null },
  );
  const saved = state.saved ?? initial;

  return (
    <form
      action={action}
      onChange={(): void => setEdited(true)}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <input type="hidden" name="version" value={saved.version} />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('identity')}</CardTitle>
            <CardDescription>{t('identityHelp')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="store-name">{t('name')}</Label>
              <Input
                id="store-name"
                name="name"
                required
                value={name}
                onChange={(event): void => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-slug">{t('slug')}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/store/</span>
                <Input
                  id="store-slug"
                  name="slug"
                  required
                  value={slug}
                  aria-describedby="store-slug-help"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(event): void => setSlug(event.target.value)}
                />
              </div>
              <p id="store-slug-help" className="text-sm text-muted-foreground">
                {t('slugHelp')}
              </p>
              {slug.trim() !== saved.slug && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {t('slugChangeNotice')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-description">{t('description')}</Label>
              <Textarea
                id="store-description"
                name="description"
                rows={4}
                value={description}
                onChange={(event): void => setDescription(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">{t('descriptionHelp')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('images')}</CardTitle>
            <CardDescription>{t('imageHelp')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="store-logo">{t('logo')}</Label>
              <Input
                id="store-logo"
                name="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={removeLogo || pending}
                onChange={(event): void => setLogo(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">{logo?.file.name ?? t('logoHelp')}</p>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="removeLogo"
                  checked={removeLogo}
                  onChange={(event): void => setRemoveLogo(event.target.checked)}
                />
                {t('removeLogo')}
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-banner">{t('banner')}</Label>
              <Input
                id="store-banner"
                name="banner"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={removeBanner || pending}
                onChange={(event): void => setBanner(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {banner?.file.name ?? t('bannerHelp')}
              </p>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="removeBanner"
                  checked={removeBanner}
                  onChange={(event): void => setRemoveBanner(event.target.checked)}
                />
                {t('removeBanner')}
              </Label>
            </div>
          </CardContent>
        </Card>
        {state.message && !edited && (
          <p
            role={state.success ? 'status' : 'alert'}
            className={
              state.success
                ? 'text-sm text-emerald-700 dark:text-emerald-400'
                : 'text-sm text-destructive'
            }
          >
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
      </div>
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('preview')}</h2>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={`/store/${saved.slug}`} target="_blank" rel="noopener noreferrer" />
            }
          >
            {t('visit')}
          </Button>
        </div>
        <Card className="overflow-hidden py-0 gap-0">
          <div className="relative aspect-[3/1] bg-muted">
            <ImagePreview
              file={removeBanner ? null : banner}
              savedUrl={removeBanner ? null : saved.bannerUrl}
              alt={t('bannerAlt')}
              className="object-cover"
            />
          </div>
          <CardContent className="relative pt-0 pb-6">
            <div className="relative -mt-10 mb-4 size-20 overflow-hidden rounded-xl border-4 border-background bg-muted">
              <ImagePreview
                file={removeLogo ? null : logo}
                savedUrl={removeLogo ? null : saved.logoUrl}
                alt={t('logoAlt')}
                className="object-contain"
              />
            </div>
            <h3 className="break-words text-xl font-semibold">{name || t('name')}</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {description || t('descriptionPlaceholder')}
            </p>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">{t('previewHelp')}</p>
      </div>
    </form>
  );
}
