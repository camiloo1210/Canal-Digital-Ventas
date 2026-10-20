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
import {
  CatalogFormFeedback,
  useCatalogFormErrors,
} from '@/features/dashboard/components/catalog-form-feedback';
import { CatalogFormActions } from '@/features/dashboard/components/catalog-form-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { FieldError } from '@/components/ui/field';
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
    (file: File | null): void =>
      setSelection(file ? { file, url: URL.createObjectURL(file) } : null),
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
  return src ? (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized={Boolean(file)}
      className={className}
      sizes="(max-width: 768px) 100vw, 400px"
    />
  ) : null;
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
  const revision = state.revision ?? 0;
  const { visibleErrors, clearField } = useCatalogFormErrors(state.fieldErrors, revision);
  const errorFor = (field: string): string | undefined => visibleErrors[field]?.[0];
  return (
    <form
      action={action}
      noValidate
      onReset={(event): void => event.preventDefault()}
      onChange={(event): void => {
        setEdited(true);
        const field = event.target.getAttribute('name') ?? '';
        clearField(field === 'removeLogo' ? 'logo' : field === 'removeBanner' ? 'banner' : field);
      }}
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <input type="hidden" name="version" value={saved.version} />
      {(Boolean(state.message && !edited) || Object.keys(visibleErrors).length > 0) && (
        <div className="order-first col-span-full">
          <CatalogFormFeedback
            revision={revision}
            error={!state.success && !edited ? state.message : null}
            fieldErrors={visibleErrors}
            targets={{
              name: 'store-name',
              slug: 'store-slug',
              description: 'store-description',
              logo: 'store-logo',
              banner: 'store-banner',
            }}
            labels={{
              name: t('name'),
              slug: t('slug'),
              description: t('description'),
              logo: t('logo'),
              banner: t('banner'),
            }}
          />
          {state.success && !edited && (
            <p
              role="status"
              className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-success"
            >
              {state.message}
            </p>
          )}
        </div>
      )}
      <div className="min-w-0 space-y-6">
        <fieldset
          disabled={pending}
          aria-busy={pending}
          className="min-w-0 space-y-6 disabled:opacity-70"
        >
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2>{t('identity')}</h2>
              </CardTitle>
              <CardDescription>{t('identityHelp')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="store-name">{t('name')}</Label>
                <Input
                  id="store-name"
                  name="name"
                  required
                  value={name}
                  onChange={(event): void => setName(event.target.value)}
                  className="min-h-11 scroll-mt-6"
                  aria-invalid={Boolean(errorFor('name'))}
                  aria-describedby={errorFor('name') ? 'store-name-error' : 'store-name-help'}
                />
                <p id="store-name-help" className="text-sm text-muted-foreground">
                  {t('nameHelp')}
                </p>
                {errorFor('name') && (
                  <FieldError id="store-name-error">{errorFor('name')}</FieldError>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-slug">{t('slug')}</Label>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-sm text-muted-foreground">
                    /store/
                  </span>
                  <Input
                    id="store-slug"
                    name="slug"
                    required
                    value={slug}
                    aria-invalid={Boolean(errorFor('slug'))}
                    aria-describedby={
                      'store-slug-help' + (errorFor('slug') ? ' store-slug-error' : '')
                    }
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(event): void => setSlug(event.target.value)}
                    className="min-h-11 scroll-mt-6"
                  />
                </div>
                <p id="store-slug-help" className="text-sm text-muted-foreground">
                  {t('slugHelp')}
                </p>
                {slug.trim() !== saved.slug && (
                  <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
                    {t('slugChangeNotice')}
                  </p>
                )}
                {errorFor('slug') && (
                  <FieldError id="store-slug-error">{errorFor('slug')}</FieldError>
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
                  aria-invalid={Boolean(errorFor('description'))}
                  aria-describedby={
                    'store-description-help' +
                    (errorFor('description') ? ' store-description-error' : '')
                  }
                  className="min-h-28 scroll-mt-6"
                />
                <p id="store-description-help" className="text-sm text-muted-foreground">
                  {t('descriptionHelp')}
                </p>
                {errorFor('description') && (
                  <FieldError id="store-description-error">{errorFor('description')}</FieldError>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2>{t('images')}</h2>
              </CardTitle>
              <CardDescription>{t('imageHelp')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="store-logo">{t('logo')}</Label>
                <Input
                  id="store-logo"
                  name="logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={removeLogo || pending}
                  onChange={(event): void => setLogo(event.target.files?.[0] ?? null)}
                  aria-invalid={Boolean(errorFor('logo'))}
                  aria-describedby={
                    'store-logo-help' + (errorFor('logo') ? ' store-logo-error' : '')
                  }
                  className="min-h-11 scroll-mt-6"
                />
                <p id="store-logo-help" className="break-words text-sm text-muted-foreground">
                  {logo?.file.name ?? t('logoHelp')}
                </p>
                <div className="flex min-h-11 items-center gap-3">
                  <Checkbox
                    id="remove-logo"
                    name="removeLogo"
                    value="on"
                    checked={removeLogo}
                    onCheckedChange={(checked): void => {
                      setRemoveLogo(checked);
                      setEdited(true);
                      clearField('logo');
                    }}
                  />
                  <Label htmlFor="remove-logo" className="min-h-11 flex-1 cursor-pointer">
                    {t('removeLogo')}
                  </Label>
                </div>
                {errorFor('logo') && (
                  <FieldError id="store-logo-error">{errorFor('logo')}</FieldError>
                )}
              </div>
              <div className="space-y-3">
                <Label htmlFor="store-banner">{t('banner')}</Label>
                <Input
                  id="store-banner"
                  name="banner"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={removeBanner || pending}
                  onChange={(event): void => setBanner(event.target.files?.[0] ?? null)}
                  aria-invalid={Boolean(errorFor('banner'))}
                  aria-describedby={
                    'store-banner-help' + (errorFor('banner') ? ' store-banner-error' : '')
                  }
                  className="min-h-11 scroll-mt-6"
                />
                <p id="store-banner-help" className="break-words text-sm text-muted-foreground">
                  {banner?.file.name ?? t('bannerHelp')}
                </p>
                <div className="flex min-h-11 items-center gap-3">
                  <Checkbox
                    id="remove-banner"
                    name="removeBanner"
                    value="on"
                    checked={removeBanner}
                    onCheckedChange={(checked): void => {
                      setRemoveBanner(checked);
                      setEdited(true);
                      clearField('banner');
                    }}
                  />
                  <Label htmlFor="remove-banner" className="min-h-11 flex-1 cursor-pointer">
                    {t('removeBanner')}
                  </Label>
                </div>
                {errorFor('banner') && (
                  <FieldError id="store-banner-error">{errorFor('banner')}</FieldError>
                )}
              </div>
            </CardContent>
          </Card>
        </fieldset>
        <CatalogFormActions cancelHref="/dashboard" label={t('save')} pendingLabel={t('saving')} />
      </div>
      <aside
        id="store-preview"
        className="order-first min-w-0 space-y-4 xl:order-last xl:sticky xl:top-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('preview')}</h2>
          <Button
            variant="outline"
            nativeButton={false}
            role="link"
            className="min-h-11"
            render={
              <Link href={'/store/' + saved.slug} target="_blank" rel="noopener noreferrer" />
            }
          >
            {t('visit')}
          </Button>
        </div>
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          <div className="relative aspect-[3/1] bg-muted">
            <ImagePreview
              file={removeBanner ? null : banner}
              savedUrl={removeBanner ? null : saved.bannerUrl}
              alt={t('bannerAlt')}
              className="object-cover"
            />
          </div>
          <CardContent className="relative pt-0 pb-6">
            <div className="relative -mt-8 mb-4 size-16 overflow-hidden rounded-xl border-4 border-background bg-muted">
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
      </aside>
    </form>
  );
}
