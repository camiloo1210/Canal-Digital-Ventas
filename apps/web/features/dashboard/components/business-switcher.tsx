'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown, Loader2, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { switchTenantAction } from '@/features/iam/actions/switch-tenant.actions';
import { withTenant } from '@/features/dashboard/utils/tenant-scope';
import type { BusinessOption } from '@/features/dashboard/utils/current-business';

export function BusinessSwitcher({
  businesses,
  current,
  onNavigate,
}: {
  businesses: readonly BusinessOption[];
  current: BusinessOption | null;
  onNavigate?: () => void;
}): React.JSX.Element {
  const t = useTranslations('BusinessSwitcher');
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const choose = (business: BusinessOption): void => {
    if (business.tenantId === current?.tenantId) return;
    setError(null);
    startTransition(async (): Promise<void> => {
      const result = await switchTenantAction(business.tenantId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      onNavigate?.();
      // A switch always lands on the overview of the chosen business: a deep link of the
      // previous business (an edit page, an order) does not exist in the new one.
      router.push(withTenant('/dashboard', result.tenantId));
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              aria-label={t('trigger', { name: current?.tenantName ?? t('none') })}
              className="min-h-12 aria-expanded:bg-muted"
            />
          }
        >
          {pending ? (
            <Loader2
              aria-hidden="true"
              className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Store aria-hidden="true" className="size-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate font-semibold">{current?.tenantName ?? t('none')}</p>
            <p className="truncate text-xs text-muted-foreground">
              {current ? t('roles.' + current.role) : t('choose')}
            </p>
          </div>
          <ChevronsUpDown aria-hidden="true" className="ml-auto size-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
            {businesses.map((business): React.JSX.Element => (
              <DropdownMenuItem
                key={business.tenantId}
                className="min-h-11 gap-2"
                disabled={pending}
                onClick={(): void => choose(business)}
              >
                <span className="min-w-0 flex-1 truncate">{business.tenantName}</span>
                <Badge variant="outline">{t('roles.' + business.role)}</Badge>
                {business.tenantId === current?.tenantId && (
                  <>
                    <Check aria-hidden="true" className="size-4" />
                    <span className="sr-only">{t('current')}</span>
                  </>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="px-2 pt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
