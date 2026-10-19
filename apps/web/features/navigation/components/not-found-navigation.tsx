'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

function useRecoveryPath(): '/' | '/dashboard' {
  const pathname = usePathname();
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') ? '/dashboard' : '/';
}

export function NotFoundHomeLink(
  props: Omit<React.ComponentProps<typeof Link>, 'href'>,
): React.JSX.Element {
  const href = useRecoveryPath();
  return <Link {...props} href={href} />;
}

export function NotFoundRecovery({
  labels,
}: {
  labels: { home: string; dashboard: string; homeHint: string; dashboardHint: string };
}): React.JSX.Element {
  const href = useRecoveryPath();
  const isDashboard = href === '/dashboard';
  return (
    <>
      <Link href={href} className={buttonVariants({ size: 'lg' })}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {isDashboard ? labels.dashboard : labels.home}
      </Link>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {isDashboard ? labels.dashboardHint : labels.homeHint}
      </p>
    </>
  );
}
