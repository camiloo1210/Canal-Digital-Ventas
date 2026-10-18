'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  changeOrderStatusAction,
  type ChangeOrderStatusActionState,
} from '@/features/orders/actions/change-order-status.actions';

interface SellerOrderStatusFormProps {
  readonly orderId: string;
  readonly version: number;
  readonly nextStatus: string;
}

const initialState: ChangeOrderStatusActionState = { success: false, errorCode: null };

export function SellerOrderStatusForm({
  orderId,
  version,
  nextStatus,
}: SellerOrderStatusFormProps): React.JSX.Element {
  const t = useTranslations('SellerOrders');
  const [state, action, pending] = useActionState(changeOrderStatusAction, initialState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" disabled={pending}>
        {pending ? t('saving') : t(`actions.${nextStatus}`)}
      </Button>
      <p
        role={state.success ? 'status' : 'alert'}
        aria-live="polite"
        className={state.success ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}
      >
        {state.message}
      </p>
    </form>
  );
}
