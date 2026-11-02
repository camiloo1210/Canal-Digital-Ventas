'use client';

import * as React from 'react';
import { logoutAction } from '@/features/iam/actions/logout.action';
import { endCartSession } from '@/features/cart/sync/cart-session';

interface LogoutFormProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Sign-out form. Before the session ends it saves the buyer's cart and clears it from this
 * browser. Without JavaScript the plain form action still signs the user out.
 */
export function LogoutForm({ className, children }: LogoutFormProps): React.JSX.Element {
  const [, startTransition] = React.useTransition();
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void endCartSession().then((): void => {
      startTransition((): void => {
        void logoutAction(data);
      });
    });
  };
  return (
    <form action={logoutAction} onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
}
