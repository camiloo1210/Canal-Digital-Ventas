'use client';

import { useActionState, useState } from 'react';
import { signupBusinessAction } from '@/features/iam/actions/signup.actions';
import { loginBusinessWithGoogleAction } from '@/features/iam/actions/login.actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSeparator,
} from '@/components/ui/field';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating your store...' : 'Create Account & Store'}
    </Button>
  );
}

export function SignupBusinessForm({ className, ...props }: React.ComponentProps<'form'>) {
  const [state, formAction] = useActionState(signupBusinessAction, {
    success: false,
    error: null,
  });

  const [storeSlug, setStoreSlug] = useState('');
  const [manualSlug, setManualSlug] = useState(false);

  // Auto-generate slug from store name
  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!manualSlug) {
      setStoreSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, ''),
      );
    }
  };

  const handleSlugInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualSlug(true);
    setStoreSlug(e.target.value);
  };

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <form action={formAction} className="flex flex-col gap-6" {...props}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Start Your Business</h1>
            <p className="text-muted-foreground text-sm text-balance">
              Create an owner account and set up your B2B store
            </p>
          </div>
          {state.error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
              <Input id="firstName" name="firstName" type="text" required placeholder="John" />
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
              <Input id="lastName" name="lastName" type="text" required placeholder="Doe" />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="owner@mybusiness.com"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input id="password" name="password" type="password" required placeholder="********" />
          </Field>

          <FieldSeparator className="my-2" />

          <Field>
            <FieldLabel htmlFor="storeName">Store Name</FieldLabel>
            <Input
              id="storeName"
              name="storeName"
              type="text"
              required
              placeholder="Acme Corp"
              onChange={handleStoreNameChange}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="storeSlug">Store URL (Slug)</FieldLabel>
            <Input
              id="storeSlug"
              name="storeSlug"
              type="text"
              required
              placeholder="acme-corp"
              value={storeSlug}
              onChange={handleSlugInput}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your store will be available at {`https://{slug}.canaldigital.com`}
            </p>
          </Field>

          <Field>
            <SubmitButton />
          </Field>
        </FieldGroup>
      </form>

      <div className="flex flex-col gap-6 w-full">
        <FieldSeparator>Or sign up with Google</FieldSeparator>
        <form action={loginBusinessWithGoogleAction} className="w-full">
          <Button variant="outline" className="w-full" type="submit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
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
            Sign up with Google
          </Button>
        </form>
        <FieldDescription className="text-center flex flex-col gap-2">
          <span>
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4 hover:opacity-80">
              Log in
            </Link>
          </span>
        </FieldDescription>
      </div>
    </div>
  );
}
