'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CategoryFormValues } from '@/features/categories/actions/categories.actions';

interface CategoryFormFieldsProps {
  revision?: number;
  fieldErrors?: Partial<Record<keyof CategoryFormValues, string[]>>;
  defaultValues?: Partial<CategoryFormValues>;
}

export function CategoryFormFields({ revision, fieldErrors, defaultValues }: CategoryFormFieldsProps) {
  const t = useTranslations('Categories');

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="name">{t('form_name')}</FieldLabel>
        <Input
          key={`name-${revision}`}
          id="name"
          name="name"
          defaultValue={defaultValues?.name}
          maxLength={100}
          required
          placeholder={t('form_name_placeholder')}
        />
        {fieldErrors?.name && (
          <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug break-words mt-[1px]">{fieldErrors.name[0]}</span>
          </div>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="description">{t('form_description')}</FieldLabel>
        <Textarea
          key={`description-${revision}`}
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          maxLength={200}
          placeholder={t('form_description_placeholder')}
          className="min-h-[100px]"
        />
        {fieldErrors?.description && (
          <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug break-words mt-[1px]">{fieldErrors.description[0]}</span>
          </div>
        )}
      </Field>
    </FieldGroup>
  );
}
