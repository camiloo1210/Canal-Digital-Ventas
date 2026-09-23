'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field';
import { useTranslations } from 'next-intl';

export type CategoryOption = {
  id: string;
  name: string;
};

interface ProductFormFieldsProps {
  categories: CategoryOption[];
  defaultValues?: {
    name?: string;
    sku?: string;
    price?: number;
    cost?: number;
    wholesalePrice?: number | null;
    categoryId?: string;
    description?: string;
    stock?: number;
    isVatExempt?: boolean;
  };
}

export function ProductFormFields({
  categories,
  defaultValues,
}: ProductFormFieldsProps): React.JSX.Element {
  const t = useTranslations('Products');

  return (
    <FieldGroup>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field>
          <FieldLabel htmlFor="name">{t('form_name')}</FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={defaultValues?.name}
            required
            placeholder={t('form_name_placeholder')}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="sku">{t('form_sku')}</FieldLabel>
          <Input
            id="sku"
            name="sku"
            defaultValue={defaultValues?.sku}
            required
            placeholder={t('form_sku_placeholder')}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Field>
          <FieldLabel htmlFor="price">{t('form_price')}</FieldLabel>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.price}
            required
            placeholder="99.99"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="cost">{t('form_cost')}</FieldLabel>
          <Input
            id="cost"
            name="cost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.cost}
            required
            placeholder="50.00"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="wholesalePrice">
            {t('form_wholesale')}{' '}
            <span className="text-muted-foreground font-normal ml-1">{t('form_optional')}</span>
          </FieldLabel>
          <Input
            id="wholesalePrice"
            name="wholesalePrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.wholesalePrice ?? ''}
            placeholder="75.00"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field>
          <FieldLabel htmlFor="stock">{t('form_stock')}</FieldLabel>
          <Input
            id="stock"
            name="stock"
            type="number"
            step="1"
            min="0"
            defaultValue={defaultValues?.stock ?? 0}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="categoryId">{t('form_category')}</FieldLabel>
          <select
            id="categoryId"
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
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="description">{t('form_description')}</FieldLabel>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          placeholder={t('form_description_placeholder')}
          className="min-h-[100px]"
        />
      </Field>

      <Field orientation="horizontal">
        <FieldContent className="items-center flex-row gap-3">
          <input
            type="checkbox"
            id="isVatExempt"
            name="isVatExempt"
            defaultChecked={defaultValues?.isVatExempt}
            className="w-4 h-4 cursor-pointer accent-primary"
          />
          <FieldLabel htmlFor="isVatExempt" className="cursor-pointer">
            {t('form_vat')}
          </FieldLabel>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="image">
          {t('form_image')}{' '}
          <span className="text-muted-foreground font-normal ml-1">{t('form_optional')}</span>
        </FieldLabel>
        <Input id="image" name="image" type="file" accept="image/*" className="cursor-pointer" />
        <FieldDescription>{t('form_image_desc')}</FieldDescription>
      </Field>
    </FieldGroup>
  );
}
