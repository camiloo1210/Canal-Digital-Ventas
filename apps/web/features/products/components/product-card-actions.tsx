'use client';

import { useTenantId } from '@/features/dashboard/components/tenant-scope';
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
  const tenantId = useTenantId();
  return (
    <CatalogItemActions
      name={productName}
      editHref={'/dashboard/catalog/products/' + productId + '/edit'}
      archived={status === 'archived'}
      archiveAction={archiveProductAction.bind(null, productId, tenantId)}
      restoreAction={unarchiveProductAction.bind(null, productId, tenantId)}
    />
  );
}
