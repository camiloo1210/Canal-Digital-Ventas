'use client';

import { useTranslations } from 'next-intl';
import type { ProductFormContextReadModel } from '@canaldigital/packages/core';
import { Input } from '@/components/ui/input';
import { DECIMAL_INPUT, WHOLE_NUMBER_INPUT } from '@/lib/input-attributes';
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
import { ProductGalleryField } from '@/features/products/components/product-gallery-field';
import {
  type ProductFormValues,
  type ProductFieldName,
} from '@/features/products/schemas/product-form.schema';

export type CategoryOption = ProductFormContextReadModel['categories'][number];
interface ProductFormFieldsProps {
  revision: number;
  fieldErrors: Partial<Record<ProductFieldName, string[]>>;
  categories: CategoryOption[];
  defaultValues?: Partial<ProductFormValues>;
  galleryUrls?: string[];
  managed: boolean;
  currency: string;
  clearField: (name: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
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
  fractionDigits,
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
  fractionDigits?: number;
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
        {...(inputMode === 'numeric'
          ? WHOLE_NUMBER_INPUT
          : inputMode === 'decimal'
            ? DECIMAL_INPUT
            : {})}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [help ? name + '-help' : '', error ? name + '-error' : ''].filter(Boolean).join(' ') ||
          undefined
        }
        className="min-h-11 scroll-mt-6"
        onChange={(): void => clearField(name)}
        onBlur={
          money || fractionDigits
            ? (event): void => {
                const digits = fractionDigits ?? 2;
                if (new RegExp(String.raw`^\d+(\.\d{1,${digits}})?$`).test(event.target.value)) {
                  const [whole, fraction = ''] = event.target.value.split('.');
                  event.target.value = whole + '.' + fraction.padEnd(digits, '0');
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
  galleryUrls,
  managed,
  currency,
  onUploadingChange,
}: ProductFormFieldsProps): React.JSX.Element {
  const t = useTranslations('CatalogForms');
  const p = useTranslations('Products');
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
        <Card id="section-basic" className="scroll-mt-32 shadow-none">
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
        <Card id="section-pricing" className="scroll-mt-32 shadow-none">
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
        <Card id="section-wholesale" className="scroll-mt-32 shadow-none">
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
        <Card id="section-package" className="scroll-mt-32 shadow-none">
          <CardHeader>
            <CardTitle>
              <h2>{t('packageTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('packageHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <ProductInput
                {...common}
                name="weightKg"
                label={t('weightKg')}
                value={defaultValues?.weightKg}
                inputMode="decimal"
                fractionDigits={3}
                help={t('weightHelp')}
                error={errorFor('weightKg')}
              />
              <ProductInput
                {...common}
                name="lengthCm"
                label={t('lengthCm')}
                value={defaultValues?.lengthCm}
                inputMode="decimal"
                fractionDigits={1}
                help={t('dimensionHelp')}
                error={errorFor('lengthCm')}
              />
              <ProductInput
                {...common}
                name="widthCm"
                label={t('widthCm')}
                value={defaultValues?.widthCm}
                inputMode="decimal"
                fractionDigits={1}
                help={t('dimensionHelp')}
                error={errorFor('widthCm')}
              />
              <ProductInput
                {...common}
                name="heightCm"
                label={t('heightCm')}
                value={defaultValues?.heightCm}
                inputMode="decimal"
                fractionDigits={1}
                help={t('dimensionHelp')}
                error={errorFor('heightCm')}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card id="section-images" className="min-w-0 scroll-mt-32 shadow-none">
        <CardHeader>
          <CardTitle>
            <h2>{t('imageTitle')}</h2>
          </CardTitle>
          <CardDescription>{t('imageHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductGalleryField
            initialUrls={galleryUrls ?? []}
            managed={managed}
            error={errorFor('image')}
            clearField={clearField}
            onUploadingChange={onUploadingChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
