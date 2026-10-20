import { getTranslations } from 'next-intl/server';
import { SellerOrdersScreen } from '@/features/orders/components/seller-orders-screen';
import type { SellerOrdersSearchParams } from '@/features/orders/queries/seller-orders-query';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('AdminOrders');
  return { title: t('metadata') };
}

export default function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SellerOrdersSearchParams>;
}): React.JSX.Element {
  return <SellerOrdersScreen searchParams={searchParams} />;
}
