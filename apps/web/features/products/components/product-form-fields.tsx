'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export type CategoryOption = {
  id: string;
  name: string;
};

interface ProductFormFieldsProps {
  revision?: number;
  fieldErrors?: Partial<Record<string, string[]>>;
  categories: CategoryOption[];
  defaultValues?: {
    name?: string;
    sku?: string;
    price?: number | string;
    cost?: number | string;
    wholesalePrice?: number | string | null;
    categoryId?: string;
    description?: string;
    stock?: number | string;
    isVatExempt?: boolean | string;
    imageUrl?: string | null;
  };
}

export function ProductFormFields({
  categories,
  defaultValues,
  fieldErrors,
  revision = 0,
}: ProductFormFieldsProps): React.JSX.Element {
  const t = useTranslations('Products');
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [clearedFields, setClearedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    setClearedFields(new Set());
  }, [fieldErrors]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    if (localErrors[name]) {
      setLocalErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (!clearedFields.has(name)) {
      setClearedFields((prev) => new Set(prev).add(name));
    }
  };

    const handleSkuBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { value, name } = e.target;
    if (!value.trim()) return;

    const stripped = value.trim().replace(/^(?:sku[\s-]*)+/i, '');
    if (stripped) {
      e.target.value = `SKU-${stripped.toUpperCase()}`;
    }
    

    if (localErrors[name]) {
      setLocalErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    if (fieldErrors?.[name] && !clearedFields.has(name)) {
      setClearedFields((prev) => new Set(prev).add(name));
    }
  };

  const handleMoneyBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!value.trim()) {
      setLocalErrors((prev) => ({ ...prev, [name]: '' }));
      return;
    }
    if (/^\d+(\.\d{1,2})?$/.test(value)) {
      setLocalErrors((prev) => ({ ...prev, [name]: '' }));
      const parts = value.split('.');
      const whole = parts[0] || '0';
      const fraction = (parts[1] || '00').padEnd(2, '0').substring(0, 2);
      e.target.value = `${whole}.${fraction}`;
    } else {
      setLocalErrors((prev) => ({ ...prev, [name]: t('error_money_format', { fallback: 'Please enter a valid amount (e.g. 10.99).' }) }));
    }
  };

  const handleStockBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!value) {
      setLocalErrors((prev) => ({ ...prev, [name]: '' }));
      return;
    }
    if (/^\d+$/.test(value)) {
      setLocalErrors((prev) => ({ ...prev, [name]: '' }));
    } else {
      setLocalErrors((prev) => ({ ...prev, [name]: t('error_stock_format', { fallback: 'Stock must be a positive whole number.' }) }));
    }
  };

  const getError = (fieldName: string) => {
    if (localErrors[fieldName]) return localErrors[fieldName];
    if (!clearedFields.has(fieldName)) return fieldErrors?.[fieldName]?.[0];
    return undefined;
  };

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultValues?.imageUrl ?? null);

  useEffect(() => {
    if (!selectedImage) return;

    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedImage]);

  return (
    <FieldGroup className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field>
              <FieldLabel htmlFor="name">{t('form_name')}</FieldLabel>
              <Input
                key={`name-${revision}`}
                id="name"
                name="name"
                maxLength={50}
                defaultValue={defaultValues?.name}
                required
                placeholder={t('form_name_placeholder')}
                onChange={handleChange}
              />
              {getError('name') && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="leading-snug break-words mt-[1px]">{getError('name')}</span>
                </div>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="sku">{t('form_sku')}</FieldLabel>
              <Input
                key={`sku-${revision}`}
                id="sku"
                name="sku"
                maxLength={20}
                defaultValue={defaultValues?.sku}
                required
                placeholder={t('form_sku_placeholder')}
                onChange={handleChange}
                onBlur={handleSkuBlur}
              />
              {getError('sku') && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="leading-snug break-words mt-[1px]">{getError('sku')}</span>
                </div>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field>
              <FieldLabel htmlFor="categoryId">{t('form_category')}</FieldLabel>
              <select
                key={`categoryId-${revision}`} id="categoryId"
                name="categoryId"
                defaultValue={defaultValues?.categoryId ?? ''}
                required
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>
                  {t('form_category_placeholder')}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {getError('categoryId') && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="leading-snug break-words mt-[1px]">{getError('categoryId')}</span>
                </div>
              )}
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="description">{t('form_description')}</FieldLabel>
            <Textarea
              key={`description-${revision}`}
              id="description"
              name="description"
              maxLength={200}
              defaultValue={defaultValues?.description}
              placeholder={t('form_description_placeholder')}
              className="min-h-[100px]"
              onChange={handleChange}
            />
            {getError('description') && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="leading-snug break-words mt-[1px]">{getError('description')}</span>
                </div>
              )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Precios y Stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Field>
              <FieldLabel htmlFor="price">{t('form_price')}</FieldLabel>
              <Input
                key={`price-${revision}`}
                id="price"
                name="price"
                type="text" inputMode="decimal" pattern="^\d*(\.\d{0,2})?$" title="Enter a valid price (e.g. 10.99)"
                defaultValue={defaultValues?.price ?? ''}
                required
                placeholder="99.99"
                onBlur={handleMoneyBlur}
                onChange={handleChange}
              />
              {getError('price') && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="leading-snug break-words mt-[1px]">{getError('price')}</span>
                </div>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="cost">{t('form_cost')}</FieldLabel>
              <Input
                key={`cost-${revision}`}
                id="cost"
                name="cost"
                type="text" inputMode="decimal" pattern="^\d*(\.\d{0,2})?$" title="Enter a valid cost (e.g. 50.00)"
                defaultValue={defaultValues?.cost ?? ''}
                required
                placeholder="50.00"
                onBlur={handleMoneyBlur}
              />
              {getError('cost') && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="leading-snug break-words mt-[1px]">{getError('cost')}</span>
                </div>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="wholesalePrice">
                {t('form_wholesale')}{' '}
                <span className="text-muted-foreground font-normal ml-1">{t('form_optional')}</span>
              </FieldLabel>
              <Input
                key={`wholesalePrice-${revision}`}
                id="wholesalePrice"
                name="wholesalePrice"
                type="text" inputMode="decimal" pattern="^\d*(\.\d{0,2})?$" title="Enter a valid wholesale price (e.g. 75.00)"
                defaultValue={defaultValues?.wholesalePrice ?? ''}
                placeholder="75.00"
                onBlur={handleMoneyBlur}
              />
              {getError('wholesalePrice') && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="leading-snug break-words mt-[1px]">{getError('wholesalePrice')}</span>
                </div>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field>
              <FieldLabel htmlFor="stock">{t('form_stock')}</FieldLabel>
              <Input
                key={`stock-${revision}`}
                id="stock"
                name="stock"
                type="text" inputMode="numeric" pattern="^\d*$" title="Enter a valid whole number for stock"
                defaultValue={defaultValues?.stock ?? 0}
                required
                onBlur={handleStockBlur}
                onChange={handleChange}
              />
              {getError('stock') && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="leading-snug break-words mt-[1px]">{getError('stock')}</span>
                </div>
              )}
            </Field>
            
            <Field orientation="horizontal" className="pt-8">
              <FieldContent className="items-center flex-row gap-3">
                <input
                  type="checkbox"
                  key={`isVatExempt-${revision}`} id="isVatExempt"
                  name="isVatExempt"
                  defaultChecked={defaultValues?.isVatExempt === true || defaultValues?.isVatExempt === 'on' || defaultValues?.isVatExempt === 'true'}
                  className="w-4 h-4 cursor-pointer accent-primary"
                />
                <FieldLabel htmlFor="isVatExempt" className="cursor-pointer">
                  {t('form_vat')}
                </FieldLabel>
              </FieldContent>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field>
            <FieldLabel htmlFor="image">
              {t('form_image')}{' '}
              <span className="text-muted-foreground font-normal ml-1">{t('form_optional')}</span>
            </FieldLabel>
            <div className="flex items-start gap-6">
              {previewUrl && (
                <div className="relative w-32 h-32 rounded-md overflow-hidden border border-border shrink-0">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1">
                <Input 
                  id="image" 
                  name="image" 
                  type="file" 
                  accept="image/*" 
                  className="cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedImage(file);
                    } else {
                      setSelectedImage(null);
                      setPreviewUrl(defaultValues?.imageUrl ?? null);
                    }
                  }} 
                />
                <FieldDescription className="mt-2">{t('form_image_desc')}</FieldDescription>
              </div>
            </div>
          </Field>
        </CardContent>
      </Card>
    </FieldGroup>
  );
}
