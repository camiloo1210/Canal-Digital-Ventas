'use client';
import { useActionState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';
import {
  retryShipmentAction,
  type RetryShipmentActionState,
} from '@/features/orders/actions/retry-shipment.actions';
import {
  downloadLabelAction,
  type LabelDownloadActionState,
} from '@/features/orders/actions/label-download.actions';
import {
  isRetryableReason,
  reasonMessageKey,
} from '@/features/orders/constants/shipment-job-reasons';

export interface ShipmentJobStatusProps {
  readonly orderId: string;
  readonly job: {
    readonly state: 'queued' | 'creating' | 'done' | 'needs_attention' | 'failed';
    readonly reason: string | null;
    readonly hasLabel: boolean;
    readonly providerTrackingNumber: string | null;
  };
}

function LabelDownload({ orderId }: { readonly orderId: string }): React.JSX.Element {
  const t = useTranslations('SellerOrders.shipmentJob');
  const initial: LabelDownloadActionState = { success: false, message: '' };
  const [state, action, pending] = useActionState(downloadLabelAction, initial);
  const url = state.success ? state.url : undefined;
  useEffect((): void => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);
  return (
    <form action={action} className="space-y-2">
      <TenantIdField />
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" disabled={pending} aria-busy={pending} className="min-h-11">
        {pending ? t('downloading') : t('download')}
      </Button>
      {url && (
        <p className="text-sm">
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
            {t('openLabel')}
          </a>
        </p>
      )}
      {!state.success && state.message && (
        <p role="alert" className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}

function RetryForm({
  orderId,
  warn,
}: {
  readonly orderId: string;
  readonly warn: boolean;
}): React.JSX.Element {
  const t = useTranslations('SellerOrders.shipmentJob');
  const initial: RetryShipmentActionState = { success: false, message: '' };
  const [state, action, pending] = useActionState(retryShipmentAction, initial);
  return (
    <form action={action} className="space-y-2">
      <TenantIdField />
      <input type="hidden" name="orderId" value={orderId} />
      {warn && (
        <p role="note" className="text-sm font-medium">
          {t('ambiguousWarning')}
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        aria-busy={pending}
        className="min-h-11"
      >
        {pending ? t('retrying') : t('retry')}
      </Button>
      {state.message && (
        <p role={state.success ? 'status' : 'alert'} className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ShipmentJobStatus({ orderId, job }: ShipmentJobStatusProps): React.JSX.Element {
  const t = useTranslations('SellerOrders.shipmentJob');
  const reason = reasonMessageKey(job.reason);
  const attention = job.state === 'needs_attention' || job.state === 'failed';
  return (
    <section
      aria-labelledby={'shipment-job-' + orderId}
      className="space-y-3 rounded-lg border p-4 text-sm"
    >
      <h3 id={'shipment-job-' + orderId} className="font-semibold">
        {t('title')}
      </h3>
      {job.state === 'queued' && <p role="status">{t('queued')}</p>}
      {job.state === 'creating' && <p role="status">{t('creating')}</p>}
      {job.state === 'done' && (
        <>
          <p role="status">{t('done')}</p>
          {job.hasLabel ? (
            <LabelDownload orderId={orderId} />
          ) : (
            <p className="text-muted-foreground">{t('doneNoLabel')}</p>
          )}
        </>
      )}
      {attention && (
        <>
          <p role="alert" className="font-medium">
            {t(job.state === 'failed' ? 'failed' : 'needsAttention')}
          </p>
          <p>
            <span className="text-muted-foreground">{t('reasonLabel')}: </span>
            {t('reasons.' + reason)}
          </p>
          {job.providerTrackingNumber ? (
            <p className="break-words">
              {t('trackingFound', { trackingNumber: job.providerTrackingNumber })}
            </p>
          ) : (
            isRetryableReason(job.reason) && (
              <RetryForm orderId={orderId} warn={job.reason === 'AMBIGUOUS_RESULT'} />
            )
          )}
        </>
      )}
    </section>
  );
}
