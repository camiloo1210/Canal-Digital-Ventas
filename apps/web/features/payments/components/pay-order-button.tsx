'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  startPaymentAction,
  type StartPaymentActionState,
} from '@/features/payments/actions/start-payment.actions';

export function PayOrderButton({ orderId }: { readonly orderId: string }): React.JSX.Element {
  const t = useTranslations('Payments');
  const initial: StartPaymentActionState = { errorCode: null, orderId };
  const [state, action, pending] = useActionState(startPaymentAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={state.orderId ?? orderId} />
      <Button type="submit" disabled={pending || state.alreadyPaid === true}>
        {pending ? t('openingCheckout') : state.alreadyPaid ? t('alreadyPaid') : t('payOrder')}
      </Button>
      {state.message && (
        <p role={state.errorCode ? 'alert' : 'status'} className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
