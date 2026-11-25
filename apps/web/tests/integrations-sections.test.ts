import { describe, expect, it } from 'vitest';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import { INTEGRATIONS_SECTIONS } from '@/features/kivi/components/integrations-sections';

describe('integrations sections', (): void => {
  it('uses unique anchors', (): void => {
    const ids = INTEGRATIONS_SECTIONS.map((section): string => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });

  it('translates the nav label and every section in both locales', (): void => {
    for (const messages of [es, en]) {
      const nav = (messages as unknown as Record<string, Record<string, string>>).IntegrationsNav;
      expect(nav.label).toBeTruthy();
      for (const section of INTEGRATIONS_SECTIONS) expect(nav[section.labelKey]).toBeTruthy();
    }
  });
});
