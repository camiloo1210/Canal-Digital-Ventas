import { createHmac, timingSafeEqual } from 'node:crypto';

export const KIVI_TOOLS_MAX_SKEW_SECONDS = 300;

export interface KiviToolsSignatureInput {
  /** Platform master key bytes (decoded KIVI_TOKEN_ENCRYPTION_KEY). Never logged. */
  masterKey: Buffer;
  tenantId: string;
  /** Unix seconds as sent in X-Kivi-Timestamp. */
  timestamp: string;
  rawBody: string;
  /** Lowercase hex as sent in X-Kivi-Signature. */
  signature: string;
  nowSeconds: number;
}

// Distinct context from the order-lookup key (domain separation).
function deriveKeyBytes(masterKey: Buffer, tenantId: string): Buffer {
  return createHmac('sha256', masterKey).update(`kivi-tools:v1:${tenantId}`).digest();
}

/** Per-store tools signing key as 64 lowercase hex chars; this is what Kivi receives. */
export function deriveKiviToolsKey(masterKeyBytes: Buffer, tenantId: string): string {
  return deriveKeyBytes(masterKeyBytes, tenantId).toString('hex');
}

export function signKiviTools(
  masterKey: Buffer,
  tenantId: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac('sha256', deriveKeyBytes(masterKey, tenantId))
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

export function verifyKiviToolsSignature(input: KiviToolsSignatureInput): boolean {
  if (input.masterKey.length !== 32) return false;
  if (!/^[0-9]{1,15}$/.test(input.timestamp)) return false;
  if (Math.abs(input.nowSeconds - Number(input.timestamp)) > KIVI_TOOLS_MAX_SKEW_SECONDS) {
    return false;
  }
  if (!/^[0-9a-f]{64}$/.test(input.signature)) return false;
  const expected = Buffer.from(
    signKiviTools(input.masterKey, input.tenantId, input.timestamp, input.rawBody),
    'hex',
  );
  const provided = Buffer.from(input.signature, 'hex');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
