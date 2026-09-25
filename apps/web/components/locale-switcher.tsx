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
import { useLocale } from 'next-intl';
import { cn } from 'cn';

export function LocaleSwitcher(): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const [optimisticLocale, setOptimisticLocale] = useOptimistic(
    locale,
    (_current: string, next: string) => next,
  );

  const isEn = optimisticLocale === 'en';

  const handleLocaleChange = (checked: boolean): void => {
    const nextLocale = checked ? 'en' : 'es';
    startTransition(async () => {
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
          Language
          {isPending && <Loader2Icon className="size-3 animate-spin ml-auto" />}
        </DropdownMenuLabel>

        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <button 
            type="button" 
            onClick={() => handleLocaleChange(false)}
            className={cn("cursor-pointer transition-colors outline-none", !isEn ? 'font-bold text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            ES
          </button>
          
          <Switch.Root
            checked={isEn}
            onCheckedChange={handleLocaleChange}
            disabled={isPending}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
              'bg-primary' // Always primary so it doesn't look "disabled" when in Spanish
            )}
          >
            <Switch.Thumb
              className={cn(
                'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                isEn ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </Switch.Root>
          
          <button 
            type="button" 
            onClick={() => handleLocaleChange(true)}
            className={cn("cursor-pointer transition-colors outline-none", isEn ? 'font-bold text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            EN
          </button>
        </div>
      </DropdownMenuGroup>
    </>
  );
}
