'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProductFormContextReadModel } from '@canaldigital/packages/core';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  PRODUCT_IMAGE_MIME_EXTENSIONS,
  PRODUCT_IMAGE_MAX_BYTES,
  type ProductFormValues,
  type ProductFieldName,
} from '@/features/products/schemas/product-form.schema';

export type CategoryOption = ProductFormContextReadModel['categories'][number];
interface ProductFormFieldsProps {
  revision: number;
  fieldErrors: Partial<Record<ProductFieldName, string[]>>;
  categories: CategoryOption[];
  defaultValues?: Partial<ProductFormValues>;
  imageUrl?: string | null;
  currency: string;
  clearField: (name: string) => void;
}

function ProductInput({
  name,
  label,
  value,
  required,
  help,
  inputMode,
  error,
  revision,
  clearField,
  money = false,
}: {
  name: keyof ProductFormValues;
  label: string;
  value?: string;
  required?: boolean;
  help?: string;
  inputMode?: 'decimal' | 'numeric';
  error?: string;
  revision: number;
  clearField: (name: string) => void;
  money?: boolean;
}): React.JSX.Element {
  return (
    <Field data-invalid={Boolean(error)} className="min-w-0">
      <FieldLabel htmlFor={name}>
        {label}
        {required && <span aria-hidden="true">*</span>}
      </FieldLabel>
      <Input
        key={name + revision}
        id={name}
        name={name}
        defaultValue={value ?? ''}
        required={required}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [help ? name + '-help' : '', error ? name + '-error' : ''].filter(Boolean).join(' ') ||
          undefined
        }
        className="min-h-11 scroll-mt-6"
        onChange={(): void => clearField(name)}
        onBlur={
          money
            ? (event): void => {
                if (/^\d+(\.\d{1,2})?$/.test(event.target.value)) {
                  const [whole, fraction = ''] = event.target.value.split('.');
                  event.target.value = whole + '.' + fraction.padEnd(2, '0');
                }
              }
            : undefined
        }
      />
      {help && <FieldDescription id={name + '-help'}>{help}</FieldDescription>}
      {error && <FieldError id={name + '-error'}>{error}</FieldError>}
    </Field>
  );
}

export function ProductFormFields({
  categories,
  defaultValues,
  fieldErrors,
  revision,
  clearField,
  imageUrl,
  currency,
}: ProductFormFieldsProps): React.JSX.Element {
  const t = useTranslations('CatalogForms');
  const p = useTranslations('Products');
  const [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl ?? null);
  const [filename, setFilename] = useState('');
  const objectUrlRef = useRef<string | null>(null);
  useEffect(
    (): (() => void) => (): void => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );
  const errorFor = (name: ProductFieldName): string | undefined => fieldErrors[name]?.[0];
  const common = { revision, clearField };
  const categoryError = errorFor('categoryId');
  const items = categories.map((category): { value: string; label: string } => ({
    value: category.id,
    label:
      category.name + (category.status !== 'active' ? ' (' + t('unavailableCategory') + ')' : ''),
  }));
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              <h2>{t('basicTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('basicDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <ProductInput
                {...common}
                name="name"
                label={p('form_name')}
                value={defaultValues?.name}
                required
                help={t('productNameHelp')}
                error={errorFor('name')}
              />
              <ProductInput
                {...common}
                name="sku"
                label={p('form_sku')}
                value={defaultValues?.sku}
                required
                help={t('skuHelp')}
                error={errorFor('sku')}
              />
            </div>
            <Field data-invalid={Boolean(categoryError)}>
              <FieldLabel htmlFor="categoryId">
                {p('form_category')}
                <span aria-hidden="true">*</span>
              </FieldLabel>
              <Select
                key={'category-' + revision}
                name="categoryId"
                required
                defaultValue={defaultValues?.categoryId || null}
                items={items}
                onValueChange={(): void => clearField('categoryId')}
              >
                <SelectTrigger
                  id="categoryId"
                  className="min-h-11 w-full scroll-mt-6"
                  aria-invalid={Boolean(categoryError)}
                  aria-describedby={categoryError ? 'categoryId-error' : 'categoryId-help'}
                >
                  <SelectValue placeholder={p('form_category_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item): React.JSX.Element => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="min-h-11 whitespace-normal"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription id="categoryId-help">{t('categoryHelp')}</FieldDescription>
              {categoryError && <FieldError id="categoryId-error">{categoryError}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(errorFor('description'))}>
              <FieldLabel htmlFor="description">
                {p('form_description')}
                <span className="font-normal text-muted-foreground">{t('optional')}</span>
              </FieldLabel>
              <Textarea
                key={'description-' + revision}
                id="description"
                name="description"
                defaultValue={defaultValues?.description ?? ''}
                className="min-h-28 scroll-mt-6"
                aria-invalid={Boolean(errorFor('description'))}
                aria-describedby={
                  'description-help' + (errorFor('description') ? ' description-error' : '')
                }
                onChange={(): void => clearField('description')}
              />
              <FieldDescription id="description-help">{t('descriptionHelp')}</FieldDescription>
              {errorFor('description') && (
                <FieldError id="description-error">{errorFor('description')}</FieldError>
              )}
            </Field>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              <h2>{t('pricingTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('currencyHelp', { currency })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <ProductInput
                {...common}
                name="price"
                label={t('price', { currency })}
                value={defaultValues?.price}
                required
                inputMode="decimal"
                money
                help={t('moneyHelp')}
                error={errorFor('price')}
              />
              <ProductInput
                {...common}
                name="cost"
                label={t('cost', { currency })}
                value={defaultValues?.cost}
                required
                inputMode="decimal"
                money
                help={t('costHelp')}
                error={errorFor('cost')}
              />
            </div>
            <ProductInput
              {...common}
              name="stock"
              label={t('stock')}
              value={defaultValues?.stock ?? '0'}
              required
              inputMode="numeric"
              help={t('stockHelp')}
              error={errorFor('stock')}
            />
            <Field data-invalid={Boolean(errorFor('isVatExempt'))}>
              <div className="flex min-h-11 items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  key={'vat-' + revision}
                  id="isVatExempt"
                  name="isVatExempt"
                  value="on"
                  defaultChecked={
                    defaultValues?.isVatExempt === 'on' || defaultValues?.isVatExempt === 'true'
                  }
                  onCheckedChange={(): void => clearField('isVatExempt')}
                  aria-invalid={Boolean(errorFor('isVatExempt'))}
                  aria-describedby={errorFor('isVatExempt') ? 'isVatExempt-error' : undefined}
                />
                <FieldLabel htmlFor="isVatExempt" className="min-h-11 flex-1 cursor-pointer">
                  {p('form_vat')}
                </FieldLabel>
              </div>
              {errorFor('isVatExempt') && (
                <FieldError id="isVatExempt-error">{errorFor('isVatExempt')}</FieldError>
              )}
            </Field>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              <h2>{t('wholesaleTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('wholesaleHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <ProductInput
                {...common}
                name="wholesalePrice"
                label={t('wholesalePrice', { currency })}
                value={defaultValues?.wholesalePrice}
                inputMode="decimal"
                money
                error={errorFor('wholesalePrice')}
              />
              <ProductInput
                {...common}
                name="wholesaleMinQuantity"
                label={p('form_wholesale_min')}
                value={defaultValues?.wholesaleMinQuantity}
                inputMode="numeric"
                help={t('wholesaleQuantityHelp')}
                error={errorFor('wholesaleMinQuantity')}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="min-w-0 shadow-none">
        <CardHeader>
          <CardTitle>
            <h2>{t('imageTitle')}</h2>
          </CardTitle>
          <CardDescription>{t('imageHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative mx-auto flex aspect-square w-full max-w-64 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={t('imagePreview')}
                fill
                unoptimized
                sizes="256px"
                className="object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 p-4 text-center text-sm text-muted-foreground">
                <ImageIcon aria-hidden="true" className="size-8" />
                {t('noImage')}
              </div>
            )}
          </div>
          <Field data-invalid={Boolean(errorFor('image'))}>
            <FieldLabel htmlFor="image">
              {p('form_image')}
              <span className="font-normal text-muted-foreground">{t('optional')}</span>
            </FieldLabel>
            <Input
              id="image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="min-h-11 w-full min-w-0 scroll-mt-6 text-sm"
              aria-invalid={Boolean(errorFor('image'))}
              aria-describedby={'image-help' + (errorFor('image') ? ' image-error' : '')}
              onChange={(event): void => {
                clearField('image');
                const file = event.target.files?.[0];
                if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
                setFilename(file?.name ?? '');
                if (
                  file &&
                  Object.hasOwn(PRODUCT_IMAGE_MIME_EXTENSIONS, file.type) &&
                  file.size <= PRODUCT_IMAGE_MAX_BYTES
                ) {
                  objectUrlRef.current = URL.createObjectURL(file);
                  setPreviewUrl(objectUrlRef.current);
                } else setPreviewUrl(imageUrl ?? null);
              }}
            />
            <FieldDescription id="image-help">{t('imageFormats')}</FieldDescription>
            {filename && <p className="break-all text-xs text-muted-foreground">{filename}</p>}
            {errorFor('image') && <FieldError id="image-error">{errorFor('image')}</FieldError>}
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}
