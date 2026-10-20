import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import { DashboardOverviewResults } from '@/features/dashboard/components/dashboard-overview-results';

const mocks = vi.hoisted((): { find: ReturnType<typeof vi.fn> } => ({ find: vi.fn() }));
vi.mock('next-intl/server', (): object => ({
  getTranslations: async (): Promise<ReturnType<typeof createTranslator>> =>
    createTranslator({ locale: 'es', messages: es.AdminOverview }),
}));
vi.mock('@/features/dashboard/di/dashboard.di', (): object => ({
  getDashboardOverviewReadRepository: (): object => ({ findForManager: mocks.find }),
}));

describe('overview recovery and access', (): void => {
  it('does not present unauthorized data as zero activity', async (): Promise<void> => {
    mocks.find.mockResolvedValue(null);
    const html = renderToStaticMarkup(
      await DashboardOverviewResults({ userId: 'actor', tenantId: 'tenant' }),
    );
    expect(mocks.find).toHaveBeenLastCalledWith('actor', 'tenant');
    expect(html).toContain('Resumen no disponible para esta cuenta');
    expect(html).not.toContain('Todavía no hay pedidos');
  });
  it('offers a real retry and masks a database failure', async (): Promise<void> => {
    mocks.find.mockRejectedValue(new Error('private database detail'));
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    try {
      const html = renderToStaticMarkup(
        await DashboardOverviewResults({ userId: 'actor', tenantId: 'tenant' }),
      );
      expect(html).toContain('No pudimos cargar el resumen');
      expect(html).toContain('action="/dashboard"');
      expect(html).toContain('method="get"');
      expect(html).not.toContain('private database detail');
      expect(html).not.toContain('Todavía no hay pedidos');
    } finally {
      spy.mockRestore();
    }
  });
});
