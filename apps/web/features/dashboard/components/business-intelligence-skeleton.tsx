import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function BusinessIntelligenceSkeleton({ label }: { label: string }): React.JSX.Element {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="space-y-6">
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key): React.JSX.Element => (
          <Skeleton key={key} className="h-40 rounded-xl motion-reduce:animate-none" />
        ))}
      </div>
      <div aria-hidden="true" className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-[28rem] rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-[28rem] rounded-xl motion-reduce:animate-none" />
      </div>
      <Skeleton aria-hidden="true" className="h-64 rounded-xl motion-reduce:animate-none" />
    </div>
  );
}
