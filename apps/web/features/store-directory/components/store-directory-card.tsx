import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
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
      className="group block h-full rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
    >
      <Card
        className={cn(
          'h-full gap-0 overflow-hidden rounded-2xl border border-border bg-card py-0 ring-0 shadow-sm transition-[border-color,box-shadow] hover:border-foreground/30 hover:shadow-md motion-reduce:transition-none',
        )}
      >
        {tenant.bannerUrl && (
          <div
            className={cn(
              'relative overflow-hidden bg-muted',
              prominent ? 'aspect-[21/9]' : 'aspect-[3/1]',
            )}
          >
            <Image
              src={tenant.bannerUrl}
              alt=""
              fill
              loading={prominent ? 'eager' : 'lazy'}
              sizes={
                prominent
                  ? '(min-width: 1200px) 768px, (min-width: 1024px) 56vw, calc(100vw - 48px)'
                  : '(min-width: 1024px) 360px, (min-width: 768px) 45vw, calc(100vw - 48px)'
              }
              className="object-cover"
            />
          </div>
        )}
        <CardContent
          className={cn('flex flex-1 flex-col gap-7 p-6', prominent && 'sm:p-8 lg:p-10')}
        >
          <div
            className={cn(
              'flex min-w-0 items-start gap-4',
              prominent && 'sm:items-center sm:gap-6',
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                'relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted text-xl font-semibold text-foreground',
                prominent && 'sm:size-24 sm:text-3xl',
              )}
            >
              {tenant.logoUrl ? (
                <Image
                  src={tenant.logoUrl}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 96px, 64px"
                  className="object-contain"
                />
              ) : (
                <span>{tenant.name.substring(0, 2).toLocaleUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <h3
                className={cn(
                  'text-lg font-semibold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]',
                  prominent && 'sm:text-2xl',
                )}
              >
                {tenant.name}
              </h3>
              <p
                className={cn(
                  'line-clamp-2 text-sm leading-relaxed text-muted-foreground',
                  prominent && 'max-w-xl sm:text-base',
                )}
              >
                {tenant.description || descriptionFallback}
              </p>
            </div>
          </div>
          <span className="mt-auto inline-flex min-h-11 w-fit items-center gap-3 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity group-hover:opacity-80 motion-reduce:transition-none">
            {visitLabel}
            <ArrowRight
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform motion-safe:group-hover:translate-x-1 motion-reduce:transition-none"
            />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
