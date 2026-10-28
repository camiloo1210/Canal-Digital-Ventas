import * as React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { resolveTenantQuery } from '@/features/iam/queries/resolve-tenant.query';
import { StoreHeader } from '@/features/store/components/store-header';
import Link from 'next/link';
import { StorefrontVitals } from '@/features/store/components/storefront-vitals';
import { getTranslations } from 'next-intl/server';
import { BuyerKiviWidget } from '@/features/store-directory/components/buyer-kivi-widget';
import { getKiviStoreWidgetReadRepository } from '@/features/kivi/di/kivi.di';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenantQuery(tenantSlug);

  if (!tenantContext) {
    const t = await getTranslations('Storefront');
    return { title: t('storeNotFound') };
  }

  return {
    title: tenantContext.name,
    description:
      tenantContext.description ||
      (await getTranslations('Storefront'))('welcome', { name: tenantContext.name }),
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}): Promise<React.JSX.Element> {
  const { tenantSlug } = await params;

  const tenantContext = await resolveTenantQuery(tenantSlug);
  if (!tenantContext) {
    notFound();
  }

  const viewer = await getStoreViewerQuery();
  let widgetKey: string | null = null;
  try {
    widgetKey =
      (await getKiviStoreWidgetReadRepository().findForStoreSlug(tenantSlug))?.widgetKey ?? null;
  } catch {
    /* A remote outage must not prevent shopping or mount another store's widget. */
  }
  const t = await getTranslations('Storefront');

  const labels = {
    login: t('login'),
    createAccount: t('createAccount'),
    logout: t('logout'),
    dashboard: t('dashboard'),
    settings: t('settings'),
    backToHome: t('backToHome'),
    backToStore: t('backToStore'),
    cartTitle: t('cartTitle', { fallback: 'Shopping Cart' }),
    cartEmpty: t('cartEmpty', { fallback: 'Your cart is empty' }),
    cartCheckout: t('cartCheckout', { fallback: 'Proceed to Checkout' }),
    cartSubtotal: t('cartSubtotal', { fallback: 'Subtotal' }),
    cartTaxesNote: t('cartTaxesNote', { fallback: '*Taxes and shipping calculated at checkout' }),
  };

  return (
    <div className="storefront min-h-screen bg-background flex flex-col">
      <Link
        href="#storefront-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-primary focus:px-4 focus:text-primary-foreground"
      >
        {t('accessibility.skipToContent')}
      </Link>
      {process.env.STOREFRONT_DIAGNOSTICS === '1' && <StorefrontVitals />}
      <StoreHeader
        viewer={viewer}
        tenantSlug={tenantSlug}
        tenantName={tenantContext.name}
        labels={labels}
      />
      <main id="storefront-main" tabIndex={-1} className="flex-1 scroll-mt-20">
        {children}
      </main>
      <BuyerKiviWidget widgetKey={widgetKey} />
    </div>
  );
}
