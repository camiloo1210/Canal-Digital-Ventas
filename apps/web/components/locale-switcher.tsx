'use client';

import { useTransition, useOptimistic } from 'react';
import { LanguagesIcon, Loader2Icon } from 'lucide-react';
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { setLocaleAction } from '@/features/i18n/actions/set-locale.action';
import { Switch } from '@base-ui/react/switch';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from 'cn';

export function LocaleSwitcher(): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const t = useTranslations('Storefront.accessibility');
  const [optimisticLocale, setOptimisticLocale] = useOptimistic(
    locale,
    (_current: string, next: string): string => next,
  );

  const isEn = optimisticLocale === 'en';

  const handleLocaleChange = (checked: boolean): void => {
    const nextLocale = checked ? 'en' : 'es';
    startTransition(async (): Promise<void> => {
      setOptimisticLocale(nextLocale);
      const formData = new FormData();
      formData.append('locale', nextLocale);
      await setLocaleAction(formData);
    });
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground flex items-center gap-2">
          <LanguagesIcon className="size-3" />
          {t('language')}
          {isPending && <Loader2Icon className="size-3 animate-spin ml-auto" />}
        </DropdownMenuLabel>

        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <button
            type="button"
            disabled={isPending}
            onClick={(): void => handleLocaleChange(false)}
            className={cn(
              'flex size-11 items-center justify-center rounded-md cursor-pointer transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none',
              !isEn ? 'font-bold text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            ES
          </button>

          <Switch.Root
            aria-label={t('englishLanguage')}
            checked={isEn}
            onCheckedChange={handleLocaleChange}
            disabled={isPending}
            className={cn(
              'relative inline-flex h-11 w-12 shrink-0 cursor-pointer items-center rounded-full before:absolute before:inset-x-1.5 before:inset-y-3 before:rounded-full before:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Switch.Thumb
              className={cn(
                'pointer-events-none absolute left-2 block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform motion-reduce:transition-none',
                isEn ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </Switch.Root>

          <button
            type="button"
            disabled={isPending}
            onClick={(): void => handleLocaleChange(true)}
            className={cn(
              'flex size-11 items-center justify-center rounded-md cursor-pointer transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none',
              isEn ? 'font-bold text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            EN
          </button>
        </div>
      </DropdownMenuGroup>
    </>
  );
}
