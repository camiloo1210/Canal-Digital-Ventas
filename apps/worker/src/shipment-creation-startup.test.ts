import { describe, expect, it } from 'vitest';
import {
  ShipmentCreationStartupError,
  describeStartupFailure,
  requireAuthorizedMarker,
  safeDriverCode,
} from '@/worker/shipment-creation-startup';

const LEGACY_LINE =
  'Sandbox shipment creation worker stopped; check configuration and permissions.';

function failureOf(action: () => unknown): unknown {
  try {
    action();
  } catch (error: unknown) {
    return error;
  }
  return expect.unreachable();
}

describe('describeStartupFailure', (): void => {
  it.each([
    'config',
    'sandbox-guard',
    'database',
    'marker',
    'authorization',
    'deployment',
  ] as const)('names the %s stage', (stage): void => {
    const line = describeStartupFailure(new ShipmentCreationStartupError(stage));
    expect(line).toBe(
      `Sandbox shipment creation worker stopped at stage "${stage}"; check configuration and permissions.`,
    );
  });

  it('appends the safe detail when there is one', (): void => {
    const line = describeStartupFailure(new ShipmentCreationStartupError('database', 'code 28P01'));
    expect(line).toBe(
      'Sandbox shipment creation worker stopped at stage "database" (code 28P01); check configuration and permissions.',
    );
  });

  it('keeps the generic line for errors it did not stage and never echoes their message', (): void => {
    const line = describeStartupFailure(new Error('postgres://worker:topsecret@host/db'));
    expect(line).toBe(LEGACY_LINE);
    expect(line).not.toContain('topsecret');
  });

  it('keeps the generic line for non-error throwables', (): void => {
    expect(describeStartupFailure('boom')).toBe(LEGACY_LINE);
  });
});

describe('safeDriverCode', (): void => {
  it.each([
    [{ code: '28P01' }, '28P01'],
    [{ code: 'ECONNREFUSED' }, 'ECONNREFUSED'],
    [{ code: 'CERT_HAS_EXPIRED' }, 'CERT_HAS_EXPIRED'],
    [{ code: 'ERR_TLS_CERT_ALTNAME_INVALID' }, 'ERR_TLS_CERT_ALTNAME_INVALID'],
  ])('returns a well-formed driver code: %o', (error, expected): void => {
    expect(safeDriverCode(error)).toBe(expected);
  });

  it.each([
    new Error('no code at all'),
    { code: 42 },
    { code: '' },
    { code: 'postgres://worker:topsecret@host/db' },
    { code: 'lowercase and spaces' },
    { code: 'A'.repeat(41) },
    'plain string',
    null,
    undefined,
  ])('returns null for anything that could carry a value: %o', (error): void => {
    expect(safeDriverCode(error)).toBeNull();
  });
});

describe('requireAuthorizedMarker', (): void => {
  it('fails at the marker stage when the sandbox marker row is missing', (): void => {
    const error = failureOf((): unknown => requireAuthorizedMarker(undefined));
    expect(error).toBeInstanceOf(ShipmentCreationStartupError);
    expect((error as ShipmentCreationStartupError).stage).toBe('marker');
  });

  it('fails at the authorization stage when the login is not a member of the worker role', (): void => {
    const error = failureOf((): unknown =>
      requireAuthorizedMarker({ environment: 'sandbox', deployment_id: 'id', authorized: false }),
    );
    expect((error as ShipmentCreationStartupError).stage).toBe('authorization');
  });

  it('returns the row when it exists and the login is authorized', (): void => {
    const row = { environment: 'sandbox', deployment_id: 'id', authorized: true };
    expect(requireAuthorizedMarker(row)).toBe(row);
  });
});
