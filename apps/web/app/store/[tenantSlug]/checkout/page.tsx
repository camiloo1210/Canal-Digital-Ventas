import * as React from 'react';
import { Metadata } from 'next';
import { resolveTenantQuery } from '@/features/iam/queries/resolve-tenant.query';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CheckoutForm } from '@/features/checkout/components/checkout-form';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t('pageTitle')}</h1>
      <Card size="sm" className="mb-6">
        <CardHeader>
          <CardTitle>
            <h2>{t('billingInfo')}</h2>
          </CardTitle>
          <CardDescription>{t('billingInfoDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-medium [overflow-wrap:anywhere]">{user.email}</p>
        </CardContent>
      </Card>
      <CheckoutForm tenantSlug={tenantSlug} />
    </div>
  );
}
