import 'server-only';
import { trackingSandboxConfig } from '@/features/orders/server/tracking-sandbox-config';

/**
 * Automatic FedEx sandbox shipment creation is queued only when the web deployment opts in
 * explicitly AND the sandbox tracking configuration is valid. Only the sandbox worker consumes
 * jobs, so any other environment must never enqueue them.
 */
export function isShipmentCreationEnabled(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env.SHIPMENT_CREATION_SANDBOX_ENABLED === 'true' && trackingSandboxConfig(env) !== null;
}
