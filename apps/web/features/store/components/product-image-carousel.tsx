'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface ProductImageCarouselProps {
  images: string[];
  alt: string;
}

const SIZES =
  '(min-width: 1280px) 584px, (min-width: 1024px) calc((100vw - 112px) / 2), (min-width: 768px) calc((100vw - 72px) / 2), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)';

export function ProductImageCarousel({
  images,
  alt,
}: ProductImageCarouselProps): React.JSX.Element {
  const t = useTranslations('Storefront');
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(0);
  const total = images.length;

  const goTo = React.useCallback((index: number): void => {
    const track = trackRef.current;
    if (!track) return;
    const bounded = Math.min(Math.max(index, 0), track.children.length - 1);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({
      left: bounded * track.clientWidth,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, []);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    const track = event.currentTarget;
    if (track.clientWidth === 0) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(active - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(active + 1);
    }
  };

  if (total === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl border bg-muted text-foreground md:aspect-square">
        {t('noImage')}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={t('galleryLabel')}
      className="space-y-3"
    >
      <div className="relative overflow-hidden rounded-xl border bg-muted">
        <div
          ref={trackRef}
          tabIndex={0}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:aspect-square [&::-webkit-scrollbar]:hidden"
        >
          {images.map((url, index): React.JSX.Element => (
            <div
              key={url}
              role="group"
              aria-roledescription="slide"
              aria-label={t('galleryCounter', { current: index + 1, total })}
              className="relative h-full w-full shrink-0 snap-center"
            >
              <Image
                src={url}
                alt={index === 0 ? alt : `${alt} (${index + 1}/${total})`}
                fill
                loading={index === 0 ? 'eager' : 'lazy'}
                className="object-cover"
                sizes={SIZES}
              />
            </div>
          ))}
        </div>
        {total > 1 && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 size-11 -translate-y-1/2 rounded-full shadow-md"
              aria-label={t('galleryPrev')}
              disabled={active === 0}
              onClick={(): void => goTo(active - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 size-11 -translate-y-1/2 rounded-full shadow-md"
              aria-label={t('galleryNext')}
              disabled={active === total - 1}
              onClick={(): void => goTo(active + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <p
              aria-live="polite"
              className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow"
            >
              {t('galleryCounter', { current: active + 1, total })}
            </p>
          </>
        )}
      </div>
      {total > 1 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((url, index): React.JSX.Element => (
            <li key={url}>
              <button
                type="button"
                aria-label={t('galleryGoTo', { n: index + 1 })}
                aria-current={index === active}
                onClick={(): void => goTo(index)}
                className="relative size-14 overflow-hidden rounded-lg border-2 border-transparent bg-muted outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring aria-[current=true]:border-primary"
              >
                <Image src={url} alt="" fill sizes="56px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
