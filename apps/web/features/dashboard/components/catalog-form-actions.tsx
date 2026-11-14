'use client';

import { TenantLink as Link } from '@/features/dashboard/components/tenant-scope';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CatalogFormActions({
  cancelHref,
  label,
  pendingLabel,
  blocked = false,
  blockedMessage,
}: {
  cancelHref: string;
  label: string;
  pendingLabel: string;
  blocked?: boolean;
  blockedMessage?: string;
}): React.JSX.Element {
  const { pending } = useFormStatus();
  const t = useTranslations('CatalogForms');
  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border/80 bg-card/90 px-4 py-3 shadow-(--shadow-raised) backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
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
        disabled={pending || blocked}
        aria-busy={pending || blocked}
        className="min-h-11 flex-1 sm:flex-none"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Check aria-hidden="true" className="size-4" />
        )}
        {pending ? pendingLabel : label}
      </Button>
      {blocked && blockedMessage && (
        <p role="status" className="w-full text-right text-xs text-muted-foreground">
          {blockedMessage}
        </p>
      )}
    </div>
  );
}
