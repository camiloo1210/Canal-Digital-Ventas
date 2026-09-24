import * as React from 'react';
import Image from 'next/image';

interface StoreProfileHeaderProps {
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export function StoreProfileHeader({
  name,
  description,
  logoUrl,
  bannerUrl,
}: StoreProfileHeaderProps): React.JSX.Element {
  return (
    <div className="w-full flex flex-col mb-8">
      {/* Banner Area */}
      <div className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-muted overflow-hidden rounded-b-xl border-b">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt={`${name} cover banner`}
            fill
            sizes="100vw"
            priority={true}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-10 bg-grid-pattern" />
        )}
      </div>

      {/* Profile Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col md:flex-row items-center md:items-end gap-4 -mt-12 md:-mt-16 relative z-10">
        {/* Avatar */}
        <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background bg-muted flex-shrink-0 overflow-hidden shadow-sm">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${name} logo`}
              fill
              sizes="(max-width: 768px) 96px, 128px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground text-3xl md:text-4xl font-bold uppercase">
              {name.substring(0, 2)}
            </div>
          )}
        </div>

        {/* Text Details */}
        <div className="flex-1 text-center md:text-left mb-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground capitalize">
            {name}
          </h1>
          {description && (
            <p className="text-muted-foreground text-sm md:text-base mt-1 max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
