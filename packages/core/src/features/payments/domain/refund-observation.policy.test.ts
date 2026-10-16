import { describe, expect, it } from 'vitest';
import {
  assessRefundObservation,
  type RefundObservationInput,
} from '@/payments/domain/refund-observation.policy';

const input: RefundObservationInput = {
  paymentAmountCents: 1500,
  baselineCents: 0,
  requestedCents: 500,
  currentBookCents: 0,
  observedCents: 500,
  corroborated: true,
  signedEventsAfterDispatch: 1,
  dispatchAtMs: 100000,
  evidenceAtMs: 110000,
  refundedAtMs: 105000,
};
describe('refund accounting specification', (): void => {
  it('closes exact corroborated coverage without attributing causality', (): void => {
    expect(assessRefundObservation(input)).toMatchObject({
      state: 'CLOSED_BY_OBSERVED_COVERAGE',
      bookAfterCents: 500,
      unattributedDeltaCents: 500,
      technicallyAttributedCents: 0,
      administrativelyAttributedCents: 0,
      consumeEvidence: true,
    });
  });
  it('books a corroborated partial refund while requiring human review', (): void => {
    expect(assessRefundObservation({ ...input, observedCents: 300 })).toMatchObject({
      state: 'OBSERVED_UNATTRIBUTED',
      bookAfterCents: 300,
      anomaly: 'PARTIAL_COVERAGE_OBSERVED',
    });
  });
  it('books corroborated excess without attributing it to the operation', (): void => {
    expect(assessRefundObservation({ ...input, observedCents: 800 })).toMatchObject({
      state: 'OBSERVED_UNATTRIBUTED',
      bookAfterCents: 800,
      anomaly: 'COVERAGE_EXCEEDED',
    });
  });
  it('caps the book while retaining the complete observed excess in the ledger', (): void => {
    expect(assessRefundObservation({ ...input, observedCents: 1800 })).toMatchObject({
      bookAfterCents: 1500,
      unattributedDeltaCents: 1800,
      anomaly: 'BOOKS_CAPPED_AT_PAYMENT_AMOUNT',
    });
  });
  it('never lowers the book', (): void => {
    expect(
      assessRefundObservation({ ...input, currentBookCents: 400, observedCents: 300 }),
    ).toMatchObject({
      bookAfterCents: 400,
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      consumeEvidence: false,
      anomaly: 'PROVIDER_REFUND_DECREASED',
    });
  });
  it('does not book uncorroborated REST evidence', (): void => {
    expect(assessRefundObservation({ ...input, corroborated: false })).toMatchObject({
      bookAfterCents: 0,
      state: 'REQUEST_ACCEPTED_BY_GATEWAY',
      consumeEvidence: false,
    });
  });
  it('never calls an unchanged book a failed refund', (): void => {
    expect(assessRefundObservation({ ...input, observedCents: 0 })).toMatchObject({
      state: 'REQUEST_ACCEPTED_BY_GATEWAY',
      bookAfterCents: 0,
      consumeEvidence: false,
    });
  });
  it('marks uncorroborated observations ambiguous after 24 hours', (): void => {
    expect(
      assessRefundObservation({
        ...input,
        corroborated: false,
        evidenceAtMs: input.dispatchAtMs + 86400000,
      }),
    ).toMatchObject({
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      anomaly: 'UNCORROBORATED_OBSERVATION_TIMEOUT',
    });
  });
  it('does not auto-close when multiple signed refunds exist', (): void => {
    expect(assessRefundObservation({ ...input, signedEventsAfterDispatch: 2 })).toMatchObject({
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      bookAfterCents: 500,
      anomaly: 'MULTIPLE_REFUND_EVENTS_AFTER_DISPATCH',
    });
  });
  it('does not auto-close after baseline drift, while preserving observed accounting', (): void => {
    expect(assessRefundObservation({ ...input, currentBookCents: 300 })).toMatchObject({
      state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
      bookAfterCents: 500,
      unattributedDeltaCents: 200,
      anomaly: 'BOOKS_BASELINE_DRIFT',
    });
  });
  it.each([null, 80000, 116000])(
    'does not auto-close an absent or out-of-window refund time %s',
    (refundedAtMs: number | null): void => {
      expect(assessRefundObservation({ ...input, refundedAtMs })).toMatchObject({
        state: 'AMBIGUOUS_UNRESOLVED_EXPOSURE',
        bookAfterCents: 500,
        anomaly: 'TIMESTAMP_OUT_OF_WINDOW',
      });
    },
  );
  it('rejects non-integral financial evidence', (): void => {
    expect((): unknown => assessRefundObservation({ ...input, observedCents: 499.5 })).toThrow();
  });
});
