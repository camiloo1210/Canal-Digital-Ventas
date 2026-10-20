import * as React from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>): React.JSX.Element {
  return (
    <nav
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>): React.JSX.Element {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-wrap items-center justify-center gap-2', className)}
      {...props}
    />
  );
}

function PaginationItem(props: React.ComponentProps<'li'>): React.JSX.Element {
  return <li data-slot="pagination-item" {...props} />;
}

function PaginationLink({
  className,
  isActive = false,
  ...props
}: React.ComponentProps<typeof Link> & { isActive?: boolean }): React.JSX.Element {
  return (
    <Link
      data-slot="pagination-link"
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? 'outline' : 'ghost' }),
        'min-h-11 min-w-11',
        className,
      )}
      {...props}
    />
  );
}

export { Pagination, PaginationContent, PaginationItem, PaginationLink };
