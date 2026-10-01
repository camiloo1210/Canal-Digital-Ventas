import * as React from 'react';
import { Metadata } from 'next';
import { resolveTenantQuery } from '@/features/iam/queries/resolve-tenant.query';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CheckoutForm } from '@/features/checkout/components/checkout-form';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const t = await getTranslations('Storefront.checkout');
  return {
    title: t('pageTitle') + ' - ' + tenantSlug,
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<React.JSX.Element> {
  const { tenantSlug } = await params;

  // 1. Resolve context
  const tenantContext = await resolveTenantQuery(tenantSlug);
  if (!tenantContext) {
    notFound();
  }

  // 2. Enforce Authentication (Safe URL return)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/store/${tenantSlug}/checkout`);
  }

  const t = await getTranslations('Storefront.checkout');

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight mb-8">{t('pageTitle')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-xl font-semibold mb-4">{t('billingInfo')}</h2>
          <p className="text-muted-foreground mb-4">{t('billingInfoDesc')}</p>
          <div className="bg-secondary/50 p-4 rounded-md">
            <p className="font-medium">{user.email}</p>
          </div>
        </div>

        <div>
          <CheckoutForm tenantSlug={tenantSlug} />
        </div>
      </div>
    </div>
  );
}
