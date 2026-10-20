'use client';

import { CatalogItemActions } from '@/features/dashboard/components/catalog-item-actions';
import {
  archiveProductAction,
  unarchiveProductAction,
} from '@/features/products/actions/products.actions';

export function ProductCardActions({
  productId,
  status,
  productName,
}: {
  productId: string;
  status: string;
  productName: string;
}): React.JSX.Element {
  return (
    <CatalogItemActions
      name={productName}
      editHref={'/dashboard/catalog/products/' + productId + '/edit'}
      archived={status === 'archived'}
      archiveAction={archiveProductAction.bind(null, productId)}
      restoreAction={unarchiveProductAction.bind(null, productId)}
    />
  );
}
