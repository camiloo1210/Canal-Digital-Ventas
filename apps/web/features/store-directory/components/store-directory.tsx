import * as React from 'react';
import { Store } from 'lucide-react';
import { PublicTenantDirectoryResult } from '@canaldigital/packages/core';
import { StoreDirectoryCard } from './store-directory-card';

interface StoreDirectoryProps {
  result: PublicTenantDirectoryResult;
  labels: {
    title: string;
    empty: string;
    visit: string;
  };
}

export function StoreDirectory({ result, labels }: StoreDirectoryProps): React.JSX.Element {
  return (
    <section>
      <div className="flex items-center gap-2 mb-6">
        <Store className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">{labels.title}</h2>
      </div>
      
      {result.items.length === 0 ? (
        <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center text-muted-foreground">
          {labels.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {result.items.map((tenant) => (
            <StoreDirectoryCard 
              key={tenant.slug} 
              tenant={tenant} 
              visitLabel={labels.visit} 
            />
          ))}
        </div>
      )}
      
      {/* Pagination goes here when implemented */}
    </section>
  );
}
