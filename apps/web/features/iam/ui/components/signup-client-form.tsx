'use client';

import { useActionState } from 'react';
import { signupClientAction } from '@/features/iam/actions/signup-client.actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing up...' : 'Create Buyer Account'}
    </Button>
  );
}

export function SignupClientForm({ tenantSlug }: { tenantSlug?: string }) {
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
          required
          placeholder="buyer@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required placeholder="********" />
      </div>

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
