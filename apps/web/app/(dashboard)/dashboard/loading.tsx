import { getTranslations } from 'next-intl/server';
import { Skeleton } from '@/components/ui/skeleton';

export default async function DashboardLoading(): Promise<React.JSX.Element> {
  const t = await getTranslations('AdminFeedback');
  return (
    <div role="status" aria-label={t('loading')} aria-busy="true">
      <div aria-hidden="true" className="h-14 border-b" />
      <div className="space-y-6 p-4 lg:p-6">
        <Skeleton aria-hidden="true" className="h-10 w-56 motion-reduce:animate-none" />
        <Skeleton aria-hidden="true" className="h-24 rounded-xl motion-reduce:animate-none" />
        <Skeleton aria-hidden="true" className="h-80 rounded-xl motion-reduce:animate-none" />
      </div>
    </div>
  );
}
