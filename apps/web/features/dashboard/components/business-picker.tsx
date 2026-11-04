'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Loader2, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { switchTenantAction } from '@/features/iam/actions/switch-tenant.actions';
import { withTenant } from '@/features/dashboard/utils/tenant-scope';

export interface BusinessPickerItem {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}

export function BusinessPicker({
  businesses,
  lastTenantId,
}: {
  businesses: readonly BusinessPickerItem[];
  lastTenantId: string | null;
}): React.JSX.Element {
  const t = useTranslations('BusinessSwitcher');
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [choosing, setChoosing] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const choose = (tenantId: string): void => {
    setError(null);
    setChoosing(tenantId);
    startTransition(async (): Promise<void> => {
      const result = await switchTenantAction(tenantId);
      if (!result.success) {
        setError(result.message);
        setChoosing(null);
        return;
      }
      router.push(withTenant('/dashboard', result.tenantId));
    });
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-3" aria-label={t('label')}>
        {businesses.map((business): React.JSX.Element => (
          <li key={business.tenantId}>
            <button
              type="button"
              disabled={pending}
              aria-busy={choosing === business.tenantId}
              onClick={(): void => choose(business.tenantId)}
              className="flex min-h-16 w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                {choosing === business.tenantId ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-5 animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Store aria-hidden="true" className="size-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{business.tenantName}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{t('roles.' + business.role)}</Badge>
                  {business.tenantId === lastTenantId && <span>{t('lastUsed')}</span>}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
