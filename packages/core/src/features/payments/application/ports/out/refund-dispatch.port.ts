import type { DispatchProviderRefund } from '@/payments/application/ports/out/provider-refund.port';

export interface RefundDispatchClaim extends DispatchProviderRefund {
  operationId: string;
  paymentId: string;
}
export interface RefundDispatchPort {
  claim(workerToken: string): Promise<RefundDispatchClaim | null>;
  markSubmitted(operationId: string, workerToken: string, providerOrderId: string): Promise<void>;
  markAmbiguous(operationId: string, workerToken: string): Promise<void>;
  markRejected(operationId: string, workerToken: string, httpStatus: number): Promise<void>;
}
