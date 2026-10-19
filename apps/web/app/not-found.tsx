import { MapPinOff, Store } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  NotFoundHomeLink,
  NotFoundRecovery,
} from '@/features/navigation/components/not-found-navigation';

export default async function NotFound(): Promise<React.JSX.Element> {
  const t = await getTranslations('NotFound');

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <NotFoundHomeLink className="inline-flex items-center gap-2 rounded-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <Store aria-hidden="true" className="size-5" />
            {t('brand')}
          </NotFoundHomeLink>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16 sm:py-24">
        <div className="grid w-full items-center gap-10 sm:gap-16 md:grid-cols-[1fr_1.2fr]">
          <div
            aria-hidden="true"
            className="relative flex items-center justify-center rounded-3xl border border-dashed border-border bg-muted/40 px-8 py-12 sm:py-16"
          >
            <span className="select-none font-mono text-[clamp(6rem,18vw,11rem)] font-semibold leading-none tracking-tighter text-foreground/15">
              404
            </span>
            <div className="absolute -bottom-5 right-8 flex size-16 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <MapPinOff className="size-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            <p className="text-sm font-medium text-muted-foreground">{t('code')}</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {t('title')}
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">{t('description')}</p>
            <NotFoundRecovery
              labels={{
                home: t('backHome'),
                dashboard: t('backDashboard'),
                homeHint: t('hint'),
                dashboardHint: t('dashboardHint'),
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
