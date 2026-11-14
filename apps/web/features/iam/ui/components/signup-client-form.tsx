'use client';

import { useActionState } from 'react';
import { signupClientAction } from '@/features/iam/actions/signup-client.actions';
import { Input } from '@/components/ui/input';
import { EMAIL_INPUT, NEW_PASSWORD_INPUT } from '@/lib/input-attributes';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { ConsentFields } from '@/features/users/components/consent-fields';
import type { DemographicOptions } from '@/features/users/constants';

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing up...' : 'Create Buyer Account'}
    </Button>
  );
}

export function SignupClientForm({
  tenantSlug,
  options,
}: {
  tenantSlug?: string;
  options: DemographicOptions;
}): React.JSX.Element {
  const [state, formAction] = useActionState(signupClientAction, {
    success: false,
    error: null,
  });

  return (
    <form action={formAction} className="space-y-4">
      {tenantSlug && <input type="hidden" name="tenantSlug" value={tenantSlug} />}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={EMAIL_INPUT.maxLength}
          required
          placeholder="buyer@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          {...NEW_PASSWORD_INPUT}
          required
          placeholder="********"
        />
      </div>

      <ConsentFields options={options} />

      {state.error && <div className="text-sm text-red-500 font-medium">{state.error}</div>}

      <SubmitButton />

      <div className="text-sm text-center text-gray-500 mt-4">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-600 hover:underline">
          Log in
        </Link>
      </div>
    </form>
  );
}
