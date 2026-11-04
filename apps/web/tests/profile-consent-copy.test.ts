import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

describe('profile consent copy', (): void => {
  it('says consent only covers future signups and past anonymous samples cannot be removed', (): void => {
    expect(en.Profile.consentHelp).toMatch(/future signups/i);
    expect(en.Profile.consentHelp).toMatch(/cannot be found or removed/i);
    expect(es.Profile.consentHelp).toMatch(/registros futuros/i);
    expect(es.Profile.consentHelp).toMatch(/no se pueden localizar ni eliminar/i);
  });
});
