'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

import { useTranslations } from 'next-intl';

interface CategoryFormFieldsProps {
  defaultValues?: {
    name?: string;
    description?: string;
  };
}

export function CategoryFormFields({ defaultValues }: CategoryFormFieldsProps) {
  const t = useTranslations('Categories');

  return (
    <FieldGroup>
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
        <FieldLabel htmlFor="description">{t('form_description')}</FieldLabel>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          placeholder={t('form_description_placeholder')}
          className="min-h-[100px]"
        />
      </Field>
    </FieldGroup>
  );
}
