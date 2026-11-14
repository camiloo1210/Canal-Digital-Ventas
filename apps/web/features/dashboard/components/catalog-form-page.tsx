import { TenantLink as Link } from '@/features/dashboard/components/tenant-scope';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';

export async function CatalogFormPage({
  title,
  description,
  backHref,
  backLabel,
  children,
  compact = false,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
  compact?: boolean;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('CatalogForms');
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { label: backLabel, href: backHref },
          { label: title, href: null },
        ]}
      />
      <div
        className={
          'mx-auto w-full space-y-6 px-4 py-6 lg:px-6 lg:py-8 ' +
          (compact ? 'max-w-3xl' : 'max-w-6xl')
        }
      >
        <header className="space-y-4">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t('back', { label: backLabel })}
          </Link>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-[1.75rem]">
              {title}
            </h1>
            <p className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground sm:text-[0.9375rem]">
              {description}
            </p>
            <p className="text-sm text-muted-foreground">{t('requiredHelp')}</p>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
