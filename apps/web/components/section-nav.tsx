'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionNavItem {
  /** DOM id of the section this entry jumps to. */
  id: string;
  label: string;
}

/**
 * In-page navigation for long dashboard screens with scroll-spy. `bar` is a sticky chip strip at
 * every width; `rail` is the same strip on small screens and a sticky vertical list from `lg`.
 * Labels arrive already translated so the component stays presentation-only.
 */
export function SectionNav({
  label,
  items,
  variant = 'bar',
  className,
}: {
  label: string;
  items: readonly SectionNavItem[];
  variant?: 'bar' | 'rail';
  className?: string;
}): React.JSX.Element | null {
  const [activeId, setActiveId] = React.useState<string | null>(items[0]?.id ?? null);
  const ids = items.map((item): string => item.id).join('|');

  React.useEffect((): (() => void) | undefined => {
    const targets = ids
      .split('|')
      .map((id): HTMLElement | null => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries): void => {
        const visible = entries.find((entry): boolean => entry.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    targets.forEach((target): void => observer.observe(target));
    return (): void => observer.disconnect();
  }, [ids]);

  if (items.length < 2) return null;

  const jump = (event: React.MouseEvent<HTMLAnchorElement>, id: string): void => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    window.history.replaceState(null, '', '#' + id);
    setActiveId(id);
  };

  return (
    <nav
      aria-label={label}
      className={cn(
        'sticky top-(--header-height) z-10 -mx-4 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 lg:-mx-6 lg:px-6',
        variant === 'rail' &&
          'lg:top-[calc(var(--header-height)+1.5rem)] lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none',
        className,
      )}
    >
      <ul
        className={cn(
          'flex gap-1 overflow-x-auto py-2',
          variant === 'rail' && 'lg:flex-col lg:overflow-visible lg:py-0',
        )}
      >
        {items.map((item): React.JSX.Element => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={'#' + item.id}
                aria-current={active ? 'location' : undefined}
                onClick={(event): void => jump(event, item.id)}
                className={cn(
                  'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 motion-reduce:transition-none',
                  active
                    ? 'bg-accent font-semibold text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
