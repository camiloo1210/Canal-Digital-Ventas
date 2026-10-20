'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import type {
  CategoryFormValues,
  CategoryFieldErrors,
} from '@/features/categories/schemas/category-form.schema';

export function CategoryFormFields({
  revision,
  fieldErrors,
  defaultValues,
  clearField,
}: {
  revision: number;
  fieldErrors: CategoryFieldErrors;
  defaultValues?: Partial<CategoryFormValues>;
  clearField: (name: string) => void;
}): React.JSX.Element {
  const t = useTranslations('Categories');
  const f = useTranslations('CatalogForms');
  return (
    <FieldGroup>
      <Field data-invalid={Boolean(fieldErrors.name?.length)}>
        <FieldLabel htmlFor="name">
          {t('form_name')}
          <span aria-hidden="true">*</span>
        </FieldLabel>
        <Input
          key={'name-' + revision}
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name ?? ''}
          aria-invalid={Boolean(fieldErrors.name?.length)}
          aria-describedby={'name-help' + (fieldErrors.name?.length ? ' name-error' : '')}
          className="min-h-11 scroll-mt-6"
          onChange={(): void => clearField('name')}
        />
        <FieldDescription id="name-help">{f('categoryNameHelp')}</FieldDescription>
        {fieldErrors.name?.[0] && <FieldError id="name-error">{fieldErrors.name[0]}</FieldError>}
      </Field>
      <Field data-invalid={Boolean(fieldErrors.description?.length)}>
        <FieldLabel htmlFor="description">
          {t('form_description')}
          <span className="font-normal text-muted-foreground">{f('optional')}</span>
        </FieldLabel>
        <Textarea
          key={'description-' + revision}
          id="description"
          name="description"
          defaultValue={defaultValues?.description ?? ''}
          aria-invalid={Boolean(fieldErrors.description?.length)}
          aria-describedby={
            'description-help' + (fieldErrors.description?.length ? ' description-error' : '')
          }
          onChange={(): void => clearField('description')}
          className="min-h-32 scroll-mt-6"
        />
        <FieldDescription id="description-help">{f('descriptionHelp')}</FieldDescription>
        {fieldErrors.description?.[0] && (
          <FieldError id="description-error">{fieldErrors.description[0]}</FieldError>
        )}
      </Field>
    </FieldGroup>
  );
}
