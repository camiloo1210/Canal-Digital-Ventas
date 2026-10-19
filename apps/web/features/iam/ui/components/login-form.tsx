'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  loginWithGoogleAction,
  loginWithEmailAction,
  ActionState,
} from '@/features/iam/actions/login.actions';
import { toast } from '@/components/ui/toast';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFormStatus } from 'react-dom';
import { buyerAuthHref, safeAuthReturnPath } from '@/features/iam/utils/auth-return-path';

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  const t = useTranslations('Storefront.auth');
  return (
    <Button type="submit" className="min-h-11" disabled={pending}>
      {pending ? t('loggingIn') : t('login')}
    </Button>
  );
}

export function LoginForm({
  className,
  message,
  redirectTo,
  ...props
}: React.ComponentProps<'form'> & { message?: string; redirectTo?: string }): React.JSX.Element {
  const t = useTranslations('Storefront.auth');
  const initialState: ActionState = { error: null, success: false };
  const [state, formAction] = useActionState(loginWithEmailAction, initialState);

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <form
        className="flex flex-col gap-6"
        action={formAction}
        {...props}
        onSubmit={(e: React.FormEvent<HTMLFormElement>): void => {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            e.preventDefault();
            toast.add({
              type: 'error',
              title: t('offlineTitle'),
              description: t('offlineDescription'),
            });
            return;
          }
        }}
      >
        <input
          type="hidden"
          name="redirectTo"
          value={redirectTo ? safeAuthReturnPath(redirectTo) : ''}
        />
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">{t('loginTitle')}</h1>
            <p className="text-muted-foreground text-sm text-balance">{t('loginDescription')}</p>
          </div>
          {state?.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {(message || state?.success) && (
            <Alert role="status">
              <AlertDescription>{state?.success ? t('success') : message}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="min-h-11"
              placeholder={t('emailPlaceholder')}
              required
            />
          </Field>
          <Field>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="min-h-11"
              required
            />
          </Field>
          <Field>
            <SubmitButton />
          </Field>
        </FieldGroup>
      </form>

      <div className="flex flex-col gap-6 w-full">
        <FieldSeparator>{t('orGoogle')}</FieldSeparator>
        <form action={loginWithGoogleAction} className="w-full">
          <input
            type="hidden"
            name="redirectTo"
            value={redirectTo ? safeAuthReturnPath(redirectTo) : ''}
          />
          <Button variant="outline" className="min-h-11 w-full" type="submit">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="mr-2 h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t('google')}
          </Button>
        </form>
        <FieldDescription className="text-center flex flex-col gap-2">
          <span>
            {t('noAccount')}{' '}
            <Link
              href={buyerAuthHref('/signup', redirectTo)}
              className="underline underline-offset-4 hover:opacity-80"
            >
              {t('createAccount')}
            </Link>
          </span>
          <span>
            {t('seller')}{' '}
            <Link href="/signup/business" className="underline underline-offset-4 hover:opacity-80">
              {t('businessSignup')}
            </Link>
          </span>
        </FieldDescription>
      </div>
    </div>
  );
}
