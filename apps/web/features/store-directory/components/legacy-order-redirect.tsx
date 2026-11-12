'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Preserve order links already sent in receipts and provider return URLs. */
export function LegacyOrderRedirect(): null {
  const router = useRouter();
  useEffect((): void => {
    if (window.location.pathname !== '/') return;
    const hash = window.location.hash;
    if (/^#order-[a-zA-Z0-9-]+$/.test(hash)) router.replace(`/purchases${hash}`);
  }, [router]);
  return null;
}
