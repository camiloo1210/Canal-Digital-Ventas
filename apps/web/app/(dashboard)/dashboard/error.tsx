'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  unstable_retry,
}: {
  unstable_retry: () => void;
}): React.JSX.Element {
  const t = useTranslations('AdminFeedback');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect((): void => {
    heading.current?.focus();
  }, []);
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 lg:px-6">
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        {t('errorTitle')}
      </h1>
      <Alert role="alert">
        <AlertTitle>{t('errorSummary')}</AlertTitle>
        <AlertDescription>{t('errorDescription')}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={unstable_retry} className="min-h-11">
          {t('retry')}
        </Button>
        <Button
          nativeButton={false}
          role="link"
          variant="outline"
          className="min-h-11"
          render={<Link href="/dashboard" />}
        >
          {t('back')}
        </Button>
      </div>
    </div>
  );
}
