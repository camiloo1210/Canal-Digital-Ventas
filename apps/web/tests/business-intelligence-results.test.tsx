import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import { describe, it, expect, vi } from 'vitest';
import { BusinessIntelligenceResults } from '@/features/dashboard/components/business-intelligence-results';
import es from '@/messages/es.json';

const mocks = vi.hoisted((): { find: ReturnType<typeof vi.fn> } => ({ find: vi.fn() }));
vi.mock('next-intl/server', (): object => ({
  getTranslations: async (): Promise<
    ReturnType<typeof createTranslator<typeof es.BusinessIntelligence>>
  > => createTranslator({ locale: 'es', messages: es.BusinessIntelligence }),
}));
vi.mock('@/features/dashboard/di/dashboard.di', (): object => ({
  getBusinessIntelligenceReadRepository: (): object => ({ findForManager: mocks.find }),
}));
const props = {
  userId: 'actor',
  tenantId: 'tenant',
  query: { days: 90 as const, leadTimeDays: 14, targetCoverageDays: 45 },
};

describe('business intelligence recovery', (): void => {
  it('does not replace access denied with zero business activity', async (): Promise<void> => {
    mocks.find.mockResolvedValue(null);
    const html = renderToStaticMarkup(await BusinessIntelligenceResults(props));
    expect(html).toContain('Análisis no disponible');
    expect(html).not.toContain('Sin ventas en este período');
    expect(mocks.find).toHaveBeenLastCalledWith('actor', 'tenant', props.query);
  });
  it('masks infrastructure failures and retries with the same scenario', async (): Promise<void> => {
    mocks.find.mockRejectedValue(new Error('private database detail'));
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    try {
      const html = renderToStaticMarkup(await BusinessIntelligenceResults(props));
      expect(html).toContain('No pudimos cargar el análisis');
      expect(html).toContain('action="/dashboard/business-intelligence"');
      expect(html).toContain('value="90"');
      expect(html).toContain('value="14"');
      expect(html).toContain('value="45"');
      expect(html).not.toContain('private database detail');
      expect(html).not.toContain('Sin ventas en este período');
    } finally {
      spy.mockRestore();
    }
  });
});
