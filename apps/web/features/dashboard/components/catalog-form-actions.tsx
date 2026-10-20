'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CatalogFormActions({
  cancelHref,
  label,
  pendingLabel,
}: {
  cancelHref: string;
  label: string;
  pendingLabel: string;
}): React.JSX.Element {
  const { pending } = useFormStatus();
  const t = useTranslations('CatalogForms');
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t bg-background/95 py-4 backdrop-blur-sm">
      <Button
        nativeButton={false}
        role="link"
        render={<Link href={cancelHref} />}
        disabled={pending}
        variant="outline"
        className="min-h-11 flex-1 sm:flex-none"
      >
        {t('cancel')}
      </Button>
      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="min-h-11 flex-1 sm:flex-none"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Check aria-hidden="true" className="size-4" />
        )}
        {pending ? pendingLabel : label}
      </Button>
    </div>
  );
}
