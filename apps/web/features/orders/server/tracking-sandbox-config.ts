import 'server-only';
import { assertSandboxEnvironment } from '@canaldigital/packages/core';

export function trackingSandboxConfig(
  env: Readonly<Record<string, string | undefined>>,
): { readonly deploymentId: string; readonly refs: Readonly<Record<string, string>> } | null {
  try {
    const deploymentId = env.TRACKING_DEPLOYMENT_ID ?? '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deploymentId))
      return null;
    assertSandboxEnvironment({
      nodeEnv: env.NODE_ENV ?? '',
      sandboxEnabled: env.TRACKING_SANDBOX_ENABLED === 'true',
      appEnv: env.APP_ENV ?? '',
      expectedDeploymentId: deploymentId,
      databaseDeploymentId: deploymentId,
      databaseEnvironment: 'sandbox',
      testDatabaseUrl: env.DATABASE_URL ?? '',
      productionDatabaseUrl: env.PRODUCTION_DATABASE_URL ?? '',
    });
    const value: unknown = JSON.parse(env.TRACKING_TENANT_REFS_JSON ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const refs: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const [tenant, ref] of Object.entries(value)) {
      if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(ref)) return null;
      refs[tenant] = ref;
    }
    return { deploymentId, refs };
  } catch {
    return null;
  }
}
