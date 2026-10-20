import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps): React.JSX.Element {
  const t = useTranslations('Orders.status');

  const normalizedStatus = status.toLowerCase();

  switch (normalizedStatus) {
    case 'pending_payment':
      return <Badge variant="outline">{t('pending_payment')}</Badge>;
    case 'refunded':
      return <Badge variant="outline">{t('refunded')}</Badge>;
    case 'draft':
      return <Badge variant="outline">{t('draft')}</Badge>;
    case 'confirmed':
      return (
        <Badge
          variant="secondary"
          className="bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/25"
        >
          {t('confirmed')}
        </Badge>
      );
    case 'processing':
      return (
        <Badge
          variant="secondary"
          className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25"
        >
          {t('processing')}
        </Badge>
      );
    case 'paid':
      return (
        <Badge variant="secondary" className="bg-success/5 text-success border-success/25">
          {t('paid')}
        </Badge>
      );
    case 'shipped':
      return (
        <Badge
          variant="secondary"
          className="bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/25"
        >
          {t('shipped')}
        </Badge>
      );
    case 'delivered':
      return (
        <Badge variant="secondary" className="bg-success/5 text-success border-success/25">
          {t('delivered')}
        </Badge>
      );
    case 'cancelled':
      return <Badge variant="destructive">{t('cancelled')}</Badge>;
    default:
      return <Badge variant="outline">{t('unknown')}</Badge>;
  }
}
