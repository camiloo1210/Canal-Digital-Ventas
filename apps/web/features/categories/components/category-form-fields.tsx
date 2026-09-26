'use client';

import { useState } from 'react';
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

export function CategoryFormFields({ revision, fieldErrors, defaultValues }: CategoryFormFieldsProps): React.JSX.Element {
  const t = useTranslations('Categories');
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [clearedFields, setClearedFields] = useState<Set<string>>(new Set());

  const [prevErrors, setPrevErrors] = useState(fieldErrors);
  if (fieldErrors !== prevErrors) {
    setPrevErrors(fieldErrors);
    setClearedFields(new Set());
  }
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    
    if (!clearedFields.has(name)) {
      setClearedFields((prev) => new Set(prev).add(name));
    }

    if (name === 'name' && value.length > 100) {
      setLocalErrors(prev => ({ ...prev, [name]: t('validation_name_maxLength') }));
    } else if (name === 'description' && value.length > 200) {
      setLocalErrors(prev => ({ ...prev, [name]: t('validation_description_maxLength') }));
    } else {
      if (localErrors[name]) {
        setLocalErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    }
  };

  const getError = (name: keyof CategoryFormValues): string | undefined => {
    if (localErrors[name]) return localErrors[name];
    if (!clearedFields.has(name)) return fieldErrors?.[name]?.[0];
    return undefined;
  };

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="name">{t('form_name')}</FieldLabel>
        <Input
          key={`name-${revision}`}
          id="name"
          name="name"
          defaultValue={defaultValues?.name}
          required
          onChange={handleChange}
          placeholder={t('form_name_placeholder')}
        />
        {getError('name') && (
          <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug break-words mt-[1px]">{getError('name')}</span>
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
          onChange={handleChange}
          placeholder={t('form_description_placeholder')}
          className="min-h-[100px]"
        />
        {getError('description') && (
          <div className="mt-1.5 flex items-start gap-1.5 bg-destructive/10 text-destructive text-[0.8rem] px-2.5 py-1.5 rounded-md font-medium border border-destructive/20 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug break-words mt-[1px]">{getError('description')}</span>
          </div>
        )}
      </Field>
    </FieldGroup>
  );
}
