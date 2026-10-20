'use client';

import { useFormStatus } from 'react-dom';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CatalogSearchButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
      {pending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <Search aria-hidden="true" className="size-4" />
      )}
      {pending ? pendingLabel : label}
    </Button>
  );
}
