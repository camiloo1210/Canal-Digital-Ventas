'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { StoreViewer } from '../queries/store-viewer.query';
import { UserNav } from '@/features/iam/components/user-nav';

interface StoreHeaderProps {
  viewer: StoreViewer;
  tenantSlug: string;
  tenantName?: string;
  labels: {
    login: string;
    createAccount: string;
    logout: string;
    dashboard: string;
    settings: string;
  };
}

export function StoreHeader({ viewer, tenantSlug, tenantName, labels }: StoreHeaderProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <Link 
            href="/" 
            className="flex items-center justify-center size-8 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Volver al buscador de tiendas"
            title="Volver al buscador de tiendas"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
          
          <div className="h-6 w-px bg-border hidden sm:block mx-1"></div>

          <Link href={`/store/${tenantSlug}`} className="font-bold text-lg md:text-xl capitalize truncate max-w-[200px] sm:max-w-none">
            {tenantName || tenantSlug}
          </Link>
        </div>

        <UserNav viewer={viewer} redirectTo={`/store/${tenantSlug}`} labels={labels} />
      </div>
    </header>
  );
}
