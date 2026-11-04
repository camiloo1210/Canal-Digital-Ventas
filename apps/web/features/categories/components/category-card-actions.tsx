'use client';

import { useTenantId } from '@/features/dashboard/components/tenant-scope';
import { CatalogItemActions } from '@/features/dashboard/components/catalog-item-actions';
import {
  archiveCategoryAction,
  unarchiveCategoryAction,
} from '@/features/categories/actions/categories.actions';

export function CategoryCardActions({
  category,
}: {
  category: { id: string; name: string; status: string };
}): React.JSX.Element {
  const tenantId = useTenantId();
  return (
    <CatalogItemActions
      name={category.name}
      editHref={'/dashboard/catalog/categories/' + category.id + '/edit'}
      archived={category.status === 'archived'}
      archiveAction={archiveCategoryAction.bind(null, category.id, tenantId)}
      restoreAction={unarchiveCategoryAction.bind(null, category.id, tenantId)}
    />
  );
}
