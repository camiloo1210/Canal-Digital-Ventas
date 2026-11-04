'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { updateOwnProfileAction } from '@/features/users/actions/profile.actions';
import type { ProfileActionState } from '@/features/users/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export interface ProfileInitial {
  firstName: string;
  lastName: string;
  email: string;
  consent: boolean;
}

export function ProfileForm({ initial }: { initial: ProfileInitial }): React.JSX.Element {
  const t = useTranslations('Profile');
  const [state, action, pending] = useActionState(updateOwnProfileAction, {
    success: false,
    message: null,
    revision: 0,
  } satisfies ProfileActionState);
  const [consent, setConsent] = useState<boolean>(initial.consent);
  const values = state.values ?? initial;
  const errors = state.fieldErrors;
  return (
    <form action={action} aria-busy={pending} className="space-y-5">
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={
            state.success
              ? 'rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm'
              : 'rounded-lg border border-destructive/40 p-3 text-sm text-destructive'
          }
        >
          {state.message}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="profile-email">{t('email')}</Label>
        <Input
          id="profile-email"
          value={initial.email}
          readOnly
          disabled
          className="min-h-11"
          aria-describedby="profile-email-help"
        />
        <p id="profile-email-help" className="text-xs text-muted-foreground">
          {t('emailHelp')}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-first-name">{t('firstName')}</Label>
          <Input
            id="profile-first-name"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={60}
            defaultValue={values.firstName}
            className="min-h-11"
            aria-invalid={Boolean(errors?.firstName)}
          />
          {errors?.firstName && (
            <p role="alert" className="text-sm text-destructive">
              {errors.firstName}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-last-name">{t('lastName')}</Label>
          <Input
            id="profile-last-name"
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={60}
            defaultValue={values.lastName}
            className="min-h-11"
            aria-invalid={Boolean(errors?.lastName)}
          />
          {errors?.lastName && (
            <p role="alert" className="text-sm text-destructive">
              {errors.lastName}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="profile-consent"
          name="consent"
          value="on"
          checked={consent}
          onCheckedChange={(checked): void => setConsent(checked)}
          className="mt-1"
          aria-describedby="profile-consent-help"
        />
        <Label htmlFor="profile-consent" className="min-h-11 flex-1 cursor-pointer">
          <span className="block font-medium">{t('consentLabel')}</span>
          <span
            id="profile-consent-help"
            className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground"
          >
            {t('consentHelp')}
          </span>
        </Label>
      </div>
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? t('saving') : t('save')}
      </Button>
    </form>
  );
}
