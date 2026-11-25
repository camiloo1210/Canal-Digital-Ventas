'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';
import {
  enableTrackingAction,
  disableTrackingAction,
  type EnableTrackingActionState,
} from '@/features/orders/actions/enable-tracking.actions';

export function SellerTrackingForm({
  orderId,
  version,
  active = false,
}: {
  readonly orderId: string;
  readonly version: number;
  readonly active?: boolean;
}): React.JSX.Element {
  const t = useTranslations('ShipmentTracking');
  const initial: EnableTrackingActionState = { success: false, message: '' };
  const [state, action, pending] = useActionState(
    active ? disableTrackingAction : enableTrackingAction,
    initial,
  );
  return (
    <form action={action} className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">{t('action.title')}</h3>
      <p className="text-sm text-muted-foreground">
        {t(active ? 'action.activeDescription' : 'action.description')}
      </p>
      <TenantIdField />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="version" value={version} />
      <Button type="submit" disabled={pending} aria-busy={pending} className="min-h-11">
        {pending
          ? t(active ? 'action.disabling' : 'action.enabling')
          : t(active ? 'action.disable' : 'action.enable')}
      </Button>
      {state.message && (
        <p className="text-sm" role={state.success ? 'status' : 'alert'}>
          {state.message}
        </p>
      )}
    </form>
  );
}
