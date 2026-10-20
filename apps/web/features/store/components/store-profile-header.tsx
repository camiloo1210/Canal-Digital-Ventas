import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StoreProfileHeaderProps {
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  labels: { banner: string; logo: string };
}

export function StoreProfileHeader({
  name,
  description,
  logoUrl,
  bannerUrl,
  labels,
}: StoreProfileHeaderProps): React.JSX.Element {
  return (
    <section
      className="mx-auto w-full max-w-7xl px-4 pt-4 pb-6 sm:px-6 sm:pt-6 lg:px-8"
      aria-labelledby="store-name"
    >
      <Card className="gap-0 py-0">
        <CardContent
          className={cn(
            'grid gap-4 p-4 sm:p-6 md:items-center lg:gap-8',
            bannerUrl && 'md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]',
          )}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border bg-muted sm:size-16">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={labels.logo}
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-full items-center justify-center bg-primary text-xl font-semibold text-primary-foreground"
                >
                  {name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <h1
                id="store-name"
                className="text-xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-2xl lg:text-3xl"
              >
                {name}
              </h1>
              {description && (
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {description}
                </p>
              )}
            </div>
          </div>
          {bannerUrl && (
            <div className="relative aspect-[21/9] w-full overflow-hidden rounded-lg bg-muted md:max-w-md md:justify-self-end">
              <Image
                src={bannerUrl}
                alt={labels.banner}
                fill
                sizes="(min-width: 1024px) 448px, (min-width: 768px) 50vw, (min-width: 640px) calc(100vw - 96px), calc(100vw - 64px)"
                loading="eager"
                className="object-contain"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
