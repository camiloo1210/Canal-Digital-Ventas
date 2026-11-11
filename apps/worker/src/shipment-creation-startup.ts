/**
 * Startup failures of the shipment creation worker, reported by stage.
 * A stage name, a configuration variable name and a driver error code identify what failed
 * without ever carrying a configured value, URL, credential or driver message.
 */
export type ShipmentCreationStage =
  'config' | 'sandbox-guard' | 'database' | 'marker' | 'authorization' | 'deployment';

const GENERIC_LINE =
  'Sandbox shipment creation worker stopped; check configuration and permissions.';

/** SQLSTATE (28P01) and Node/TLS (ECONNREFUSED, CERT_HAS_EXPIRED) codes: upper case, digits, _. */
const DRIVER_CODE = /^[A-Z0-9_]{3,40}$/;

export class ShipmentCreationStartupError extends Error {
  public readonly stage: ShipmentCreationStage;
  public readonly detail: string | null;

  public constructor(stage: ShipmentCreationStage, detail: string | null = null) {
    super(
      stage === 'config'
        ? 'Invalid sandbox shipment creation worker configuration'
        : `Sandbox shipment creation startup failed at stage ${stage}`,
    );
    this.name = 'ShipmentCreationStartupError';
    this.stage = stage;
    this.detail = detail;
  }
}

/** Returns a driver error code only when it is a well-formed code, never free text. */
export function safeDriverCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' && DRIVER_CODE.test(code) ? code : null;
}

/** The single log line for a failed startup. Unstaged errors keep the generic line. */
export function describeStartupFailure(error: unknown): string {
  if (!(error instanceof ShipmentCreationStartupError)) return GENERIC_LINE;
  const detail = error.detail ? ` (${error.detail})` : '';
  return `Sandbox shipment creation worker stopped at stage "${error.stage}"${detail}; check configuration and permissions.`;
}

export interface SandboxMarkerRow {
  readonly environment: string;
  readonly deployment_id: string;
  readonly authorized: boolean;
}

/** Separates "no marker row" from "login is not a member of the worker role". */
export function requireAuthorizedMarker(row: SandboxMarkerRow | undefined): SandboxMarkerRow {
  if (!row) throw new ShipmentCreationStartupError('marker');
  if (!row.authorized) throw new ShipmentCreationStartupError('authorization');
  return row;
}
