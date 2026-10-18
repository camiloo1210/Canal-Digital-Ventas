import { InvalidPaymentAttributeException } from '@/payments/domain/exceptions/invalid-payment-attribute.exception';

export interface RefundObservationInput {
  readonly paymentAmountCents: number;
  readonly baselineCents: number;
  readonly requestedCents: number;
  readonly currentBookCents: number;
  readonly observedCents: number | null;
  readonly corroborated: boolean;
  readonly signedEventsAfterDispatch: number;
  readonly dispatchAtMs: number;
  readonly evidenceAtMs: number;
  readonly refundedAtMs: number | null;
}
export type RefundObservationState =
  | 'REQUEST_ACCEPTED_BY_GATEWAY'
  | 'CLOSED_BY_OBSERVED_COVERAGE'
  | 'OBSERVED_UNATTRIBUTED'
  | 'AMBIGUOUS_UNRESOLVED_EXPOSURE';
export interface RefundObservationDecision {
  readonly state: RefundObservationState;
  readonly bookAfterCents: number;
  readonly unattributedDeltaCents: number;
  readonly technicallyAttributedCents: 0;
  readonly administrativelyAttributedCents: 0;
  readonly consumeEvidence: boolean;
  readonly anomaly: string | null;
}

/** Executable accounting rule mirrored by RPC 15; a temporal match never proves causality. */
export function assessRefundObservation(input: RefundObservationInput): RefundObservationDecision {
  const integers = [
    input.paymentAmountCents,
    input.baselineCents,
    input.requestedCents,
    input.currentBookCents,
    input.signedEventsAfterDispatch,
    input.dispatchAtMs,
    input.evidenceAtMs,
  ];
  if (
    !integers.every((value: number): boolean => Number.isSafeInteger(value)) ||
    input.paymentAmountCents <= 0 ||
    input.requestedCents <= 0 ||
    input.baselineCents < 0 ||
    input.currentBookCents < 0 ||
    input.currentBookCents > input.paymentAmountCents ||
    input.baselineCents + input.requestedCents > input.paymentAmountCents ||
    input.signedEventsAfterDispatch < 0 ||
    (input.observedCents !== null &&
      (!Number.isSafeInteger(input.observedCents) || input.observedCents < 0))
  ) {
    throw new InvalidPaymentAttributeException('Invalid refund observation inputs.');
  }
  const unchanged = {
    bookAfterCents: input.currentBookCents,
    unattributedDeltaCents: 0,
    technicallyAttributedCents: 0 as const,
    administrativelyAttributedCents: 0 as const,
    consumeEvidence: false,
  };
  const observed = input.observedCents;
  if (observed === null)
    return {
      ...unchanged,
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      anomaly: 'EVIDENCE_AMOUNT_MISSING',
    };
  if (observed < input.currentBookCents)
    return {
      ...unchanged,
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      anomaly: 'PROVIDER_REFUND_DECREASED',
    };
  if (!input.corroborated || observed === input.baselineCents) {
    const timedOut = input.evidenceAtMs - input.dispatchAtMs >= 86400000;
    return {
      ...unchanged,
      state: timedOut ? 'AMBIGUOUS_UNRESOLVED_EXPOSURE' : 'REQUEST_ACCEPTED_BY_GATEWAY',
      anomaly: timedOut ? 'UNCORROBORATED_OBSERVATION_TIMEOUT' : null,
    };
  }
  const accounted = {
    ...unchanged,
    bookAfterCents: Math.min(observed, input.paymentAmountCents),
    unattributedDeltaCents: observed - input.currentBookCents,
    consumeEvidence: true,
  };
  const expected = input.baselineCents + input.requestedCents;
  if (observed > expected)
    return {
      ...accounted,
      state: 'OBSERVED_UNATTRIBUTED',
      anomaly:
        observed > input.paymentAmountCents
          ? 'BOOKS_CAPPED_AT_PAYMENT_AMOUNT'
          : 'COVERAGE_EXCEEDED',
    };
  if (observed < expected)
    return { ...accounted, state: 'OBSERVED_UNATTRIBUTED', anomaly: 'PARTIAL_COVERAGE_OBSERVED' };
  if (input.currentBookCents !== input.baselineCents)
    return {
      ...accounted,
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      anomaly: 'BOOKS_BASELINE_DRIFT',
    };
  if (input.signedEventsAfterDispatch !== 1)
    return {
      ...accounted,
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      anomaly: 'MULTIPLE_REFUND_EVENTS_AFTER_DISPATCH',
    };
  if (
    input.refundedAtMs === null ||
    !Number.isSafeInteger(input.refundedAtMs) ||
    input.refundedAtMs < input.dispatchAtMs - 15000 ||
    input.refundedAtMs > input.evidenceAtMs + 5000
  ) {
    return {
      ...accounted,
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      anomaly: 'TIMESTAMP_OUT_OF_WINDOW',
    };
  }
  return { ...accounted, state: 'CLOSED_BY_OBSERVED_COVERAGE', anomaly: null };
}
