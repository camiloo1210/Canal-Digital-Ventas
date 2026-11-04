'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DemographicOptions } from '@/features/users/constants';
import type { ConsentValues } from '@/features/users/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Dimension = 'ageRange' | 'gender' | 'province';

function BucketSelect({
  dimension,
  name,
  values,
  defaultValue,
}: {
  dimension: Dimension;
  name: string;
  values: readonly string[];
  defaultValue: string;
}): React.JSX.Element {
  const t = useTranslations('Users.demographics');
  const NONE = '';
  const items = [
    { value: NONE, label: t('notSpecified') },
    ...values.map((value): { value: string; label: string } => ({
      value,
      label: t(`values.${dimension}.${value}`),
    })),
  ];
  const id = `consent-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t(`dimensions.${dimension}`)}</Label>
      <Select name={name} items={items} defaultValue={defaultValue}>
        <SelectTrigger id={id} className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item): React.JSX.Element => (
            <SelectItem key={item.value || 'none'} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Optional, unchecked-by-default consent to anonymous demographic statistics. The bucket
 * selectors exist (and are submitted) only while consent is ticked.
 */
export function ConsentFields({
  options,
  initial,
}: {
  options: DemographicOptions;
  initial?: ConsentValues;
}): React.JSX.Element {
  const t = useTranslations('Users.demographics');
  const [consent, setConsent] = useState<boolean>(initial?.consent ?? false);
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="demographic-consent"
          name="consent"
          value="on"
          checked={consent}
          onCheckedChange={(checked): void => setConsent(checked)}
          className="mt-1"
          aria-describedby="demographic-consent-help"
        />
        <Label htmlFor="demographic-consent" className="min-h-11 flex-1 cursor-pointer">
          <span className="block font-medium">{t('consentLabel')}</span>
          <span
            id="demographic-consent-help"
            className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground"
          >
            {t('consentHelp')}
          </span>
        </Label>
      </div>
      {consent && (
        <div className="grid gap-4 sm:grid-cols-3">
          <BucketSelect
            dimension="ageRange"
            name="ageRange"
            values={options.ageRanges}
            defaultValue={initial?.ageRange ?? ''}
          />
          <BucketSelect
            dimension="gender"
            name="gender"
            values={options.genders}
            defaultValue={initial?.gender ?? ''}
          />
          <BucketSelect
            dimension="province"
            name="province"
            values={options.provinces}
            defaultValue={initial?.province ?? ''}
          />
        </div>
      )}
    </div>
  );
}
