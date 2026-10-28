import { describe, expect, it } from 'vitest';
import { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';

describe('KiviBaseUrl', (): void => {
  it('normalizes a public https origin', (): void => {
    expect(KiviBaseUrl.from('https://api.kivi.example').getValue()).toBe(
      'https://api.kivi.example',
    );
    expect(KiviBaseUrl.from('HTTPS://API.Kivi.example/').getValue()).toBe(
      'https://api.kivi.example',
    );
  });

  it.each([
    'http://api.kivi.example',
    'ftp://api.kivi.example',
    'https://user:pass@api.kivi.example',
    'https://api.kivi.example/api/v1',
    'https://api.kivi.example/?x=1',
    'https://api.kivi.example/#frag',
    'https://localhost',
    'https://foo.localhost',
    'https://127.0.0.1',
    'https://10.0.0.5',
    'https://172.16.4.1',
    'https://192.168.1.1',
    'https://169.254.169.254',
    'https://0.0.0.0',
    'https://100.64.0.1',
    'https://[::1]',
    'https://[fe80::1]',
    'https://[fc00::1]',
    'https://[::ffff:127.0.0.1]',
    'https://metadata.google.internal',
    'https://kivi.internal',
    'https://kivi.local',
    'https://2130706433',
    'https://0x7f.1',
    'not a url',
    '',
  ])('rejects %s', (raw: string): void => {
    expect((): KiviBaseUrl => KiviBaseUrl.from(raw)).toThrow(InvalidKiviConnectionException);
  });

  it('allows http loopback only when explicitly enabled for development', (): void => {
    expect(
      KiviBaseUrl.from('http://localhost:8000', { allowLocalDevelopment: true }).getValue(),
    ).toBe('http://localhost:8000');
    expect((): KiviBaseUrl =>
      KiviBaseUrl.from('http://10.0.0.1:8000', { allowLocalDevelopment: true }),
    ).toThrow(InvalidKiviConnectionException);
  });

  it('keeps an explicit non-default port', (): void => {
    expect(KiviBaseUrl.from('https://api.kivi.example:8443').getValue()).toBe(
      'https://api.kivi.example:8443',
    );
  });
});
