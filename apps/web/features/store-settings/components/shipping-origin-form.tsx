'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ShippingOriginProps } from '@canaldigital/packages/core';
import {
  saveShippingOriginAction,
  type ShippingOriginField,
  type ShippingOriginState,
} from '@/features/store-settings/actions/shipping-origin.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PHONE_INPUT, POSTAL_CODE_INPUT } from '@/lib/input-attributes';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';

const FIELDS: readonly ShippingOriginField[] = [
  'contactName',
  'phone',
  'street',
  'city',
  'state',
  'zipCode',
  'country',
];

const EMPTY: Record<ShippingOriginField, string> = {
  contactName: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
};

export function ShippingOriginForm({
  initial,
}: {
  initial: ShippingOriginProps | null;
}): React.JSX.Element {
  const t = useTranslations('ShippingOrigin');
  const [values, setValues] = useState<Record<ShippingOriginField, string>>(initial ?? EMPTY);
  const [edited, setEdited] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: ShippingOriginState, formData: FormData): Promise<ShippingOriginState> => {
      const result = await saveShippingOriginAction(previous, formData);
      setEdited(false);
      if (result.values) setValues(result.values);
      return result;
    },
    { success: false, message: null },
  );
  const errorFor = (field: ShippingOriginField): string | undefined =>
    edited ? undefined : state.fieldErrors?.[field]?.[0];
  return (
    <form action={action} noValidate aria-busy={pending} onChange={(): void => setEdited(true)}>
      <TenantIdField />
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>
            <h2>{t('title')}</h2>
          </CardTitle>
          <CardDescription>{t('help')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {state.message && !edited && (
            <p
              role={state.success ? 'status' : 'alert'}
              className={state.success ? 'text-sm text-success' : 'text-sm text-destructive'}
            >
              {state.message}
            </p>
          )}
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field: ShippingOriginField): React.JSX.Element => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`origin-${field}`}>{t(`fields.${field}`)}</Label>
                <Input
                  id={`origin-${field}`}
                  name={field}
                  required
                  {...(field === 'phone'
                    ? PHONE_INPUT
                    : field === 'zipCode'
                      ? POSTAL_CODE_INPUT
                      : { maxLength: field === 'country' ? 2 : 120 })}
                  autoCapitalize={field === 'country' ? 'characters' : undefined}
                  value={values[field]}
                  onChange={(event): void => setValues({ ...values, [field]: event.target.value })}
                  className="min-h-11"
                  aria-invalid={Boolean(errorFor(field))}
                  aria-describedby={errorFor(field) ? `origin-${field}-error` : undefined}
                />
                {errorFor(field) && (
                  <FieldError id={`origin-${field}-error`}>{errorFor(field)}</FieldError>
                )}
              </div>
            ))}
          </fieldset>
          <Button type="submit" disabled={pending} className="min-h-11">
            {pending ? t('saving') : t('save')}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
