import type { CatalogStatus } from '@canaldigital/packages/core';
import { Badge } from '@/components/ui/badge';

export function CatalogStatusBadge({
  status,
  label,
}: {
  status: CatalogStatus;
  label: string;
}): React.JSX.Element {
  return (
    <Badge
      variant="outline"
      className={
        status === 'active'
          ? 'border-success/25 bg-success/5 text-success'
          : status === 'out_of_stock'
            ? 'border-destructive/25 bg-destructive/5 text-destructive'
            : 'bg-muted text-muted-foreground'
      }
    >
      {label}
    </Badge>
  );
}
