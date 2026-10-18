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
    case 'confirmed':
      return (
        <Badge
          variant="secondary"
          className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200"
        >
          {t('confirmed')}
        </Badge>
      );
    case 'processing':
      return (
        <Badge
          variant="secondary"
          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200"
        >
          {t('processing')}
        </Badge>
      );
    case 'paid':
      return (
        <Badge
          variant="secondary"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200"
        >
          {t('paid')}
        </Badge>
      );
    case 'shipped':
      return (
        <Badge
          variant="secondary"
          className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200"
        >
          {t('shipped')}
        </Badge>
      );
    case 'delivered':
      return (
        <Badge
          variant="secondary"
          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300"
        >
          {t('delivered')}
        </Badge>
      );
    case 'cancelled':
      return <Badge variant="destructive">{t('cancelled')}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
