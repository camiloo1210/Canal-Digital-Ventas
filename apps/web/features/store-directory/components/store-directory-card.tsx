import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { PublicTenantDirectoryItem } from '@canaldigital/packages/core';

interface StoreDirectoryCardProps {
  tenant: PublicTenantDirectoryItem;
  visitLabel: string;
}

export function StoreDirectoryCard({ tenant, visitLabel }: StoreDirectoryCardProps): React.JSX.Element {
  return (
    <Link href={`/store/${tenant.slug}`} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      <Card className="group h-full overflow-hidden transition-shadow shadow-sm hover:shadow-md border-border bg-card flex flex-col relative">
        {/* Banner */}
        <div className="relative w-full aspect-[21/9] bg-muted border-b border-border">
          {tenant.bannerUrl ? (
            <Image
              src={tenant.bannerUrl}
              alt={`${tenant.name} banner`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
          )}
        </div>

        {/* Logo / Content Area */}
        <div className="p-4 flex flex-col flex-grow items-center text-center relative">
          {/* Avatar overlapped */}
          <div className="relative w-16 h-16 rounded-full border-4 border-card bg-muted shadow-sm flex items-center justify-center -mt-12 mb-3 overflow-hidden z-10 flex-shrink-0">
            {tenant.logoUrl ? (
              <Image
                src={tenant.logoUrl}
                alt={`${tenant.name} logo`}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <span className="text-xl font-bold uppercase text-muted-foreground">
                {tenant.name.substring(0, 2)}
              </span>
            )}
          </div>

          <h3 className="text-lg font-bold text-foreground capitalize line-clamp-1 group-hover:text-primary transition-colors">
            {tenant.name}
          </h3>
          
          {tenant.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {tenant.description}
            </p>
          )}

          <div className="mt-auto pt-4">
            <span className="text-sm font-medium text-primary group-hover:underline">
              {visitLabel} &rarr;
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
