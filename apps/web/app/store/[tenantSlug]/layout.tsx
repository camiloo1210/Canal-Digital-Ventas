import * as React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { resolveTenantQuery } from '@/features/iam/queries/resolve-tenant.query';
import { StoreHeader } from '@/features/store/components/store-header';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenantQuery(tenantSlug);

  if (!tenantContext) {
    return { title: 'Store Not Found' };
  }

  return {
    title: tenantContext.name,
    description: tenantContext.description || `Welcome to ${tenantContext.name}`,
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
  const t = await getTranslations('Storefront');

  const labels = {
    login: t('login'),
    createAccount: t('createAccount'),
    logout: t('logout'),
    dashboard: t('dashboard'),
    settings: t('settings'),
    back: t('back', { fallback: 'Back' }),
    cartTitle: t('cartTitle', { fallback: 'Shopping Cart' }),
    cartEmpty: t('cartEmpty', { fallback: 'Your cart is empty' }),
    cartCheckout: t('cartCheckout', { fallback: 'Proceed to Checkout' }),
    cartSubtotal: t('cartSubtotal', { fallback: 'Subtotal' }),
    cartTaxesNote: t('cartTaxesNote', { fallback: '*Taxes and shipping calculated at checkout' }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StoreHeader
        viewer={viewer}
        tenantSlug={tenantSlug}
        tenantName={tenantContext.name}
        labels={labels}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
