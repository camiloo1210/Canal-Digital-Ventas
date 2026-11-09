import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class UnsafeTrackingEnvironmentException extends ApplicationException {
  public constructor() {
    super('Tracking requires an isolated sandbox environment');
  }
}
export interface SandboxEnvironment {
  readonly nodeEnv: string;
  readonly sandboxEnabled: boolean;
  readonly appEnv: string;
  readonly expectedDeploymentId: string;
  readonly databaseDeploymentId: string;
  readonly databaseEnvironment: string;
  readonly testDatabaseUrl: string;
  readonly productionDatabaseUrl: string;
}
export function assertSandboxEnvironment(input: SandboxEnvironment): void {
  try {
    const test = new URL(input.testDatabaseUrl);
    const production = input.productionDatabaseUrl ? new URL(input.productionDatabaseUrl) : null;
    const identity = (url: URL): string =>
      `${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname}`;
    if (
      !input.sandboxEnabled ||
      input.appEnv !== 'test' ||
      input.databaseEnvironment !== 'sandbox' ||
      !input.expectedDeploymentId ||
      input.expectedDeploymentId !== input.databaseDeploymentId ||
      !['postgres:', 'postgresql:'].includes(test.protocol) ||
      (production !== null && !['postgres:', 'postgresql:'].includes(production.protocol)) ||
      !test.hostname ||
      (production !== null && (!production.hostname || identity(test) === identity(production)))
    )
      throw new UnsafeTrackingEnvironmentException();
  } catch {
    throw new UnsafeTrackingEnvironmentException();
  }
}
