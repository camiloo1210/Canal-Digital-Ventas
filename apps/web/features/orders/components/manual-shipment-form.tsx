'use client';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';
import {
  registerManualShipmentAction,
  type ManualShipmentActionState,
} from '@/features/orders/actions/register-manual-shipment.actions';

export function ManualShipmentForm({
  orderId,
  version,
  carrier,
  trackingNumber,
}: {
  readonly orderId: string;
  readonly version: number;
  readonly carrier: string;
  readonly trackingNumber: string;
}): React.JSX.Element {
  const t = useTranslations('SellerOrders.shipment');
  const initial: ManualShipmentActionState = {
    success: false,
    message: '',
    values: { carrier, trackingNumber },
  };
  const [state, action, pending] = useActionState(registerManualShipmentAction, initial);
  const [edited, setEdited] = useState(false);
  return (
    <form
      action={action}
      onSubmit={(): void => setEdited(false)}
      className="space-y-4 rounded-lg border p-4"
    >
      <h3 className="text-base font-semibold">{t('title')}</h3>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      <TenantIdField />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="version" value={version} />
      <div className="space-y-2">
        <Label htmlFor={'carrier-' + orderId}>{t('carrier')}</Label>
        <Input
          id={'carrier-' + orderId}
          name="carrier"
          maxLength={120}
          defaultValue={state.values.carrier}
          onChange={(): void => setEdited(true)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={'tracking-' + orderId}>{t('tracking')}</Label>
        <Input
          id={'tracking-' + orderId}
          name="trackingNumber"
          maxLength={120}
          defaultValue={state.values.trackingNumber}
          onChange={(): void => setEdited(true)}
        />
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending} className="min-h-11">
        {pending ? t('saving') : t('save')}
      </Button>
      {!edited && !pending && state.message && (
        <p role={state.success ? 'status' : 'alert'} className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
