import { getTranslations } from 'next-intl/server';
import type { TenantSearchParams } from '@/features/dashboard/utils/tenant-scope';
import { UsersScreen } from '@/features/users/components/users-screen';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Users');
  return { title: t('metadata') };
}

export default function UsersPage({
  searchParams,
}: {
  searchParams: Promise<TenantSearchParams>;
}): Promise<React.JSX.Element> {
  return UsersScreen({ searchParams });
}
