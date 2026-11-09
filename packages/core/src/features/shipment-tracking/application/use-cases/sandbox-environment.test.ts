import { describe, expect, it } from 'vitest';
import { assertSandboxEnvironment } from '@/shipment-tracking/application/use-cases/sandbox-environment';

describe('sandbox tracking environment', (): void => {
  it('allows tracking only with matching test deployment marker', (): void => {
    expect((): void =>
      assertSandboxEnvironment({
        nodeEnv: 'production',
        sandboxEnabled: true,
        appEnv: 'test',
        expectedDeploymentId: 'test-id',
        databaseDeploymentId: 'test-id',
        databaseEnvironment: 'sandbox',
        testDatabaseUrl: 'postgres://test',
        productionDatabaseUrl: 'postgres://production',
      }),
    ).not.toThrow();
  });
  it.each([
    { sandboxEnabled: false },
    { appEnv: 'production' },
    { databaseEnvironment: 'production' },
    { databaseDeploymentId: 'wrong' },
    { productionDatabaseUrl: 'postgres://test' },
    { expectedDeploymentId: '' },
  ])('rejects insecure configuration %o', (override): void => {
    expect((): void =>
      assertSandboxEnvironment({
        nodeEnv: 'production',
        sandboxEnabled: true,
        appEnv: 'test',
        expectedDeploymentId: 'test-id',
        databaseDeploymentId: 'test-id',
        databaseEnvironment: 'sandbox',
        testDatabaseUrl: 'postgres://test',
        productionDatabaseUrl: 'postgres://production',
        ...override,
      }),
    ).toThrow();
  });
  it('allows a test deployment without an official production database yet', (): void => {
    expect((): void =>
      assertSandboxEnvironment({
        nodeEnv: 'production',
        sandboxEnabled: true,
        appEnv: 'test',
        expectedDeploymentId: 'test-id',
        databaseDeploymentId: 'test-id',
        databaseEnvironment: 'sandbox',
        testDatabaseUrl: 'postgres://test',
        productionDatabaseUrl: '',
      }),
    ).not.toThrow();
  });
});
