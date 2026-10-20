import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicTenantDirectoryItem } from '@canaldigital/packages/core';
import { cn } from '@/lib/utils';

interface StoreDirectoryCardProps {
  tenant: PublicTenantDirectoryItem;
  visitLabel: string;
  descriptionFallback: string;
  prominent?: boolean;
}

export function StoreDirectoryCard({
  tenant,
  visitLabel,
  descriptionFallback,
  prominent = false,
}: StoreDirectoryCardProps): React.JSX.Element {
  return (
    <Link
      href={`/store/${tenant.slug}`}
      className="group block h-full rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
    >
      <Card
        className={cn(
          'h-full gap-0 overflow-hidden rounded-xl border border-border py-0 ring-0 shadow-none [box-shadow:none] transition-colors hover:border-foreground/30 motion-reduce:transition-none',
          !prominent && 'bg-muted/25',
        )}
      >
        {prominent && tenant.bannerUrl && (
          <div className="relative aspect-[21/9] overflow-hidden bg-muted">
            <Image
              src={tenant.bannerUrl}
              alt=""
              fill
              loading="eager"
              sizes="(min-width: 1200px) 650px, (min-width: 1024px) 56vw, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
              className="object-cover"
            />
          </div>
        )}
        <CardContent className={cn('flex h-full flex-col gap-5 p-5 sm:p-6', prominent && 'h-auto')}>
          <div className="flex min-w-0 items-start gap-4">
            <div
              aria-hidden="true"
              className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-lg font-semibold text-foreground"
            >
              {tenant.logoUrl ? (
                <Image src={tenant.logoUrl} alt="" fill sizes="56px" className="object-contain" />
              ) : (
                <span>{tenant.name.substring(0, 2).toLocaleUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]">
                {tenant.name}
              </h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {tenant.description || descriptionFallback}
              </p>
            </div>
          </div>
          <span className="mt-auto flex items-center justify-between gap-4 text-sm font-medium text-foreground">
            {visitLabel}
            <ArrowUpRight
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-reduce:transition-none"
            />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
