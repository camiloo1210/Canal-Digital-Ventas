import { describe, expect, it } from 'vitest';
import { buildWorkerUrl, validatePassword } from '@/scripts/provision-kivi-sync-login.mjs';

describe('provision-kivi-sync-login', (): void => {
  it('reports invalid configuration with a named custom exception', (): void => {
    expect((): void => validatePassword('short')).toThrow(
      expect.objectContaining({ name: 'KiviLoginProvisioningException' }),
    );
  });
  const admin =
    'postgresql://postgres.abcdref:adminpw@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

  it('builds the worker URL with the restricted user and a URL-encoded password', (): void => {
    const url = new URL(buildWorkerUrl(admin, 'p@ss/word:with#chars-1234567890'));
    expect(url.username).toBe('canaldigital_kivi_sync.abcdref');
    expect(decodeURIComponent(url.password)).toBe('p@ss/word:with#chars-1234567890');
    expect(url.host).toBe('aws-0-us-east-1.pooler.supabase.com:6543');
    expect(url.pathname).toBe('/postgres');
    expect(url.toString()).not.toContain('adminpw');
  });

  it('uses a plain role name when the admin URL has no project suffix', (): void => {
    const url = new URL(
      buildWorkerUrl('postgresql://postgres:x@localhost:5432/db', 'a'.repeat(24)),
    );
    expect(url.username).toBe('canaldigital_kivi_sync');
  });

  it('rejects short passwords and characters that break the ALTER ROLE literal', (): void => {
    expect((): void => validatePassword('short')).toThrow();
    expect((): void => validatePassword(undefined)).toThrow();
    expect((): void => validatePassword(`${'a'.repeat(24)}'; DROP ROLE x;--`)).toThrow();
    expect((): void => validatePassword('a'.repeat(24))).not.toThrow();
    expect((): void => validatePassword('Uu0-mixed-chars-with-u-and-0-ok')).not.toThrow();
    expect((): void => validatePassword('a'.repeat(24) + String.fromCharCode(92))).toThrow();
  });
});
