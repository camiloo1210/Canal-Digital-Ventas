'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
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
      <Button type="submit" disabled={pending} aria-busy={pending} className="min-h-11">
        {pending && (
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        )}
        {pending ? t('saving') : t(`actions.${nextStatus}`)}
      </Button>
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          aria-live="polite"
          className={state.success ? 'text-sm text-success' : 'text-sm text-destructive'}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
