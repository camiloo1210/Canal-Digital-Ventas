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
        'h-6 gap-1.5 px-2.5 ' +
        (status === 'active'
          ? 'border-success/25 bg-success/10 text-success'
          : status === 'out_of_stock'
            ? 'border-destructive/25 bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground')
      }
    >
      <span
        aria-hidden="true"
        className={
          'size-1.5 rounded-full ' +
          (status === 'active'
            ? 'bg-success'
            : status === 'out_of_stock'
              ? 'bg-destructive'
              : 'bg-muted-foreground/60')
        }
      />
      {label}
    </Badge>
  );
}
