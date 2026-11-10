/** Every reason code the shipment creation worker can store; each has an es/en message. */
export const SHIPMENT_JOB_REASONS = [
  'MISSING_PACKAGE_DATA',
  'INVALID_PACKAGE_DATA',
  'MISSING_ORIGIN',
  'MISSING_CREDENTIALS',
  'AMBIGUOUS_RESULT',
  'INTERNAL_ERROR',
  'INVALID_RECIPIENT_COUNTRY',
  'INVALID_ORIGIN_COUNTRY',
  'ORDER_NOT_PROCESSING',
  'AUTHORIZATION',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_CONFIGURATION',
  'PROVIDER_REJECTED',
  'LABEL_UNAVAILABLE',
  'SHIPMENT_ALREADY_RECORDED',
] as const;

export type ShipmentJobReason = (typeof SHIPMENT_JOB_REASONS)[number];

/** Reasons for which a retry can never make progress, so the seller is not offered one. */
export function isRetryableReason(reason: string | null): boolean {
  return reason !== 'SHIPMENT_ALREADY_RECORDED';
}

/** Unknown carrier codes (e.g. a sanitized FedEx error code) map to the generic message. */
export function reasonMessageKey(reason: string | null): ShipmentJobReason | 'UNKNOWN' {
  return SHIPMENT_JOB_REASONS.find((code): boolean => code === reason) ?? 'UNKNOWN';
}
