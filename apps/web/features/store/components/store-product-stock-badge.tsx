import * as React from 'react';
import { PublicStockAvailability } from '@canaldigital/packages/core';
import { Badge } from '@/components/ui/badge';
import { getTranslations } from 'next-intl/server';

interface StoreProductStockBadgeProps {
  availability: PublicStockAvailability;
}

export async function StoreProductStockBadge({
  availability,
}: StoreProductStockBadgeProps): Promise<React.JSX.Element | null> {
  const t = await getTranslations('Storefront.stock');

  switch (availability) {
    case 'AVAILABLE':
      return <Badge variant="default">{t('available')}</Badge>;
    case 'LOW_STOCK':
      return <Badge variant="warning">{t('lowStock')}</Badge>;
    case 'OUT_OF_STOCK':
      return <Badge variant="destructive">{t('outOfStock')}</Badge>;
    case 'CHECK_AVAILABILITY':
      return <Badge variant="secondary">{t('checkAvailability')}</Badge>;
    default:
      return null;
  }
}
