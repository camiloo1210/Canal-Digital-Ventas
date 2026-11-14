'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { staffLoginIdentifier } from '@canaldigital/packages/core';
import {
  acceptInvitationAction,
  acceptInvitationAsCurrentUserAction,
} from '@/features/users/actions/invite.actions';
import { startGoogleInvitationAction } from '@/features/users/actions/google-invite.actions';
import { ConsentFields } from '@/features/users/components/consent-fields';
import type { DemographicOptions } from '@/features/users/constants';
import type { AcceptInvitationActionState } from '@/features/users/types';
import { GoogleIcon } from '@/features/iam/ui/components/google-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const INITIAL: AcceptInvitationActionState = { success: false, message: null, revision: 0 };

function consentInitial(
  values: AcceptInvitationActionState['values'],
): { consent: boolean; ageRange: string; gender: string; province: string } | undefined {
  return values
    ? {
        consent: values.consent,
        ageRange: values.ageRange,
        gender: values.gender,
        province: values.province,
      }
    : undefined;
}

function ErrorAlert({ message }: { message: string | null }): React.JSX.Element | null {
  return message ? (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null;
}

function NameFields({ state }: { state: AcceptInvitationActionState }): React.JSX.Element {
  const t = useTranslations('Users.invite');
  const errors = state.fieldErrors;
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field>
        <FieldLabel htmlFor="invite-first-name">{t('firstName')}</FieldLabel>
        <Input
          id="invite-first-name"
          name="firstName"
          autoComplete="given-name"
          required
          maxLength={60}
          defaultValue={state.values?.firstName ?? ''}
          className="min-h-11"
          aria-invalid={Boolean(errors?.firstName)}
        />
        {errors?.firstName && <FieldError>{errors.firstName}</FieldError>}
      </Field>
      <Field>
        <FieldLabel htmlFor="invite-last-name">{t('lastName')}</FieldLabel>
        <Input
          id="invite-last-name"
          name="lastName"
          autoComplete="family-name"
          required
          maxLength={60}
          defaultValue={state.values?.lastName ?? ''}
          className="min-h-11"
          aria-invalid={Boolean(errors?.lastName)}
        />
        {errors?.lastName && <FieldError>{errors.lastName}</FieldError>}
      </Field>
    </div>
  );
}

function PasswordField({
  state,
  withConfirmation,
}: {
  state: AcceptInvitationActionState;
  withConfirmation: boolean;
}): React.JSX.Element {
  const t = useTranslations('Users.invite');
  const errors = state.fieldErrors;
  return (
    <>
      <Field>
        <FieldLabel htmlFor="invite-password">{t('password')}</FieldLabel>
        <Input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="min-h-11"
          aria-invalid={Boolean(errors?.password)}
          aria-describedby="invite-password-help"
        />
        <FieldDescription id="invite-password-help">{t('passwordHelp')}</FieldDescription>
        {errors?.password && <FieldError>{errors.password}</FieldError>}
      </Field>
      {withConfirmation && (
        <Field>
          <FieldLabel htmlFor="invite-confirm-password">{t('confirmPassword')}</FieldLabel>
          <Input
            id="invite-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="min-h-11"
            aria-invalid={Boolean(errors?.confirmPassword)}
          />
          {errors?.confirmPassword && <FieldError>{errors.confirmPassword}</FieldError>}
        </Field>
      )}
    </>
  );
}

/** Shown once the generated login email exists: the person must save it before moving on. */
export function GeneratedEmailNotice({
  email,
  succeeded,
}: {
  email: string;
  succeeded: boolean;
}): React.JSX.Element {
  const t = useTranslations('Users.invite');
  const [copied, setCopied] = useState(false);
  const identifier = staffLoginIdentifier(email);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(identifier);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-6" data-testid="generated-email-notice">
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-bold">
          {succeeded ? t('generatedEmailTitle') : t('generatedEmailPendingTitle')}
        </h2>
        <p className="text-muted-foreground text-sm text-balance">{t('generatedEmailIntro')}</p>
      </div>
      <Field>
        <FieldLabel htmlFor="invite-generated-email">{t('generatedEmailLabel')}</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="invite-generated-email"
            readOnly
            value={identifier}
            className="min-h-11 font-mono text-xs"
            onFocus={(event: React.FocusEvent<HTMLInputElement>): void =>
              event.currentTarget.select()
            }
          />
          <Button type="button" variant="outline" className="min-h-11" onClick={copy}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
        <span role="status" className="sr-only">
          {copied ? t('copied') : ''}
        </span>
      </Field>
      <Alert variant="destructive">
        <TriangleAlert aria-hidden="true" />
        <AlertTitle>{t('generatedEmailWarningTitle')}</AlertTitle>
        <AlertDescription>{t('generatedEmailWarning')}</AlertDescription>
      </Alert>
      {succeeded && (
        <Button nativeButton={false} render={<Link href="/dashboard" />} className="min-h-11">
          {t('continueToDashboard')}
        </Button>
      )}
    </div>
  );
}

/** GENERATED_EMAIL: only the name and a password; the system derives the login email. */
export function InviteGeneratedForm({
  token,
  options,
}: {
  token: string;
  options: DemographicOptions;
}): React.JSX.Element {
  const t = useTranslations('Users.invite');
  const [state, action, pending] = useActionState(acceptInvitationAction, INITIAL);
  if (state.generatedEmail && state.success) {
    return <GeneratedEmailNotice email={state.generatedEmail} succeeded />;
  }
  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value="GENERATED_EMAIL" />
      <FieldGroup>
        <ErrorAlert message={state.message} />
        {state.generatedEmail && (
          <GeneratedEmailNotice email={state.generatedEmail} succeeded={false} />
        )}
        <NameFields state={state} />
        <FieldDescription>{t('generatedEmailHint')}</FieldDescription>
        <PasswordField state={state} withConfirmation />
        <ConsentFields
          key={state.revision}
          options={options}
          initial={consentInitial(state.values)}
        />
        <Field>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? t('submitting') : t('submit')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

/** REAL_EMAIL: the person types their own email address. */
export function InviteSignupForm({
  token,
  options,
}: {
  token: string;
  options: DemographicOptions;
}): React.JSX.Element {
  const t = useTranslations('Users.invite');
  const [state, action, pending] = useActionState(acceptInvitationAction, INITIAL);
  const errors = state.fieldErrors;
  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value="REAL_EMAIL" />
      <FieldGroup>
        <ErrorAlert message={state.message} />
        <NameFields state={state} />
        <Field>
          <FieldLabel htmlFor="invite-email">{t('email')}</FieldLabel>
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email ?? ''}
            className="min-h-11"
            aria-invalid={Boolean(errors?.email)}
          />
          {errors?.email && <FieldError>{errors.email}</FieldError>}
        </Field>
        <PasswordField state={state} withConfirmation={false} />
        <ConsentFields
          key={state.revision}
          options={options}
          initial={consentInitial(state.values)}
        />
        <Field>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? t('submitting') : t('submit')}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          {t('haveAccount')}{' '}
          <Link href="/login" className="underline underline-offset-4 hover:opacity-80">
            {t('login')}
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}

/** GOOGLE: no password; the invitation and consent choices travel through the OAuth redirect. */
export function InviteGoogleForm({
  token,
  options,
}: {
  token: string;
  options: DemographicOptions;
}): React.JSX.Element {
  const t = useTranslations('Users.invite');
  return (
    <form action={startGoogleInvitationAction} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        <ConsentFields options={options} />
        <Field>
          <Button variant="outline" type="submit" className="min-h-11 w-full">
            <GoogleIcon className="mr-2 h-4 w-4" />
            {t('googleButton')}
          </Button>
          <FieldDescription className="text-center">{t('googleHelp')}</FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}

export function InviteExistingAccountForm({
  token,
  email,
  options,
}: {
  token: string;
  email: string;
  options: DemographicOptions;
}): React.JSX.Element {
  const t = useTranslations('Users.invite');
  const [state, action, pending] = useActionState(acceptInvitationAsCurrentUserAction, INITIAL);
  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        <p className="text-sm">{t('signedInAs', { email })}</p>
        <ErrorAlert message={state.message} />
        <ConsentFields key={state.revision} options={options} initial={state.values} />
        <Field>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? t('submitting') : t('acceptExisting')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
