import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

const STEPS = ['placed', 'paid', 'processing', 'shipped', 'delivered'] as const;
type ProgressStep = (typeof STEPS)[number];

const CURRENT_STEP: Readonly<Record<string, ProgressStep>> = {
  draft: 'placed',
  confirmed: 'placed',
  pending_payment: 'placed',
  paid: 'paid',
  processing: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
};

/** Amazon-style progress bar; cancelled and refunded orders show no progress. */
export function BuyerOrderProgress({
  status,
}: {
  readonly status: string;
}): React.JSX.Element | null {
  const t = useTranslations('Orders.progress');
  const current = CURRENT_STEP[status.toLowerCase()];
  if (!current) return null;
  const currentIndex = STEPS.indexOf(current);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={t('title')}>
      {STEPS.map((step, index): React.JSX.Element => {
        const done = index < currentIndex || (step === 'delivered' && index === currentIndex);
        const active = index === currentIndex && !done;
        return (
          <li
            key={step}
            className="flex flex-col items-center gap-1.5 text-center"
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={
                'flex size-7 items-center justify-center rounded-full border text-xs font-semibold ' +
                (done
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground')
              }
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
            </span>
            <span
              className={
                'text-[11px] leading-tight sm:text-xs ' +
                (done || active ? 'font-medium text-foreground' : 'text-muted-foreground')
              }
            >
              {t(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
