'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckIcon, LockIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { updateOwnProfileAction } from '@/features/users/actions/profile.actions';
import type { ProfileActionState } from '@/features/users/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ProfileInitial {
  firstName: string;
  lastName: string;
  email: string;
  consent: boolean;
}

interface EditedFields {
  revision: number;
  firstName: boolean;
  lastName: boolean;
}

export function ProfileForm({ initial }: { initial: ProfileInitial }): React.JSX.Element {
  const t = useTranslations('Profile');
  const [state, action, pending] = useActionState(updateOwnProfileAction, {
    success: false,
    message: null,
    revision: 0,
  } satisfies ProfileActionState);
  // The saved baseline moves forward after a successful save, so "unsaved changes" stays accurate.
  const baseline = state.success && state.values ? state.values : initial;
  const [firstName, setFirstName] = useState<string>((state.values ?? initial).firstName);
  const [lastName, setLastName] = useState<string>((state.values ?? initial).lastName);
  const [consent, setConsent] = useState<boolean>((state.values ?? initial).consent);
  const [edited, setEdited] = useState<EditedFields>({
    revision: 0,
    firstName: false,
    lastName: false,
  });
  const dirty =
    firstName !== baseline.firstName ||
    lastName !== baseline.lastName ||
    consent !== baseline.consent;
  // A server error is stale as soon as that field is edited again.
  const fresh = edited.revision === state.revision;
  const firstNameError = fresh && edited.firstName ? undefined : state.fieldErrors?.firstName;
  const lastNameError = fresh && edited.lastName ? undefined : state.fieldErrors?.lastName;
  const failed = Boolean(state.message) && !state.success;
  const showSaved = state.success && !dirty && !pending;

  function discard(): void {
    setFirstName(baseline.firstName);
    setLastName(baseline.lastName);
    setConsent(baseline.consent);
  }

  return (
    <form action={action} aria-busy={pending} className="space-y-6">
      {failed && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.personal.title')}</CardTitle>
          <CardDescription>{t('sections.personal.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">{t('firstName')}</Label>
              <Input
                id="profile-first-name"
                name="firstName"
                autoComplete="given-name"
                required
                maxLength={60}
                value={firstName}
                onChange={(event): void => {
                  setFirstName(event.target.value);
                  setEdited((previous): EditedFields => ({
                    ...previous,
                    revision: state.revision,
                    firstName: true,
                  }));
                }}
                className="min-h-11"
                aria-invalid={Boolean(firstNameError)}
                aria-describedby={firstNameError ? 'profile-first-name-error' : undefined}
              />
              {firstNameError && (
                <p id="profile-first-name-error" role="alert" className="text-sm text-destructive">
                  {firstNameError}
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
                value={lastName}
                onChange={(event): void => {
                  setLastName(event.target.value);
                  setEdited((previous): EditedFields => ({
                    ...previous,
                    revision: state.revision,
                    lastName: true,
                  }));
                }}
                className="min-h-11"
                aria-invalid={Boolean(lastNameError)}
                aria-describedby={lastNameError ? 'profile-last-name-error' : undefined}
              />
              {lastNameError && (
                <p id="profile-last-name-error" role="alert" className="text-sm text-destructive">
                  {lastNameError}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">{t('email')}</Label>
            <div className="relative">
              <LockIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="profile-email"
                value={initial.email}
                readOnly
                disabled
                className="min-h-11 pl-9"
                aria-describedby="profile-email-help"
              />
            </div>
            <p id="profile-email-help" className="text-xs text-muted-foreground">
              {t('emailHelp')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheckIcon aria-hidden="true" className="size-5 text-primary" />
            {t('sections.privacy.title')}
          </CardTitle>
          <CardDescription>{t('sections.privacy.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t('sections.privacy.sharedTitle')}</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {(['ageRange', 'gender', 'province'] as const).map((item): React.JSX.Element => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{t(`sections.privacy.shared.${item}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t('sections.privacy.neverTitle')}</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {(['identity', 'link', 'individual'] as const).map((item): React.JSX.Element => (
                  <li key={item} className="flex items-start gap-2">
                    <XIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <span>{t(`sections.privacy.never.${item}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-xl sm:border">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {pending
            ? t('saving')
            : showSaved
              ? (state.message ?? t('saved'))
              : dirty
                ? t('unsaved')
                : t('upToDate')}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={discard}
            disabled={!dirty || pending}
          >
            {t('discard')}
          </Button>
          <Button type="submit" className="min-h-11" disabled={!dirty || pending}>
            {pending ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    </form>
  );
}
