export interface RecordPaymentEvidence {
  ticketId: string;
  workerToken: string;
  url: string;
  httpStatus: number;
  payload: Uint8Array;
  sha256: string;
  headers: Readonly<Record<string, string>>;
}
export interface PaymentEvidenceRecorderPort {
  record(input: RecordPaymentEvidence): Promise<string>;
}
