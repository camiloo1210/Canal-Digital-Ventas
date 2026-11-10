export interface LabelStoragePort {
  /** Stores a label PDF privately and returns its path `${tenantId}/${uuid}.pdf`. */
  put(tenantId: string, pdf: Uint8Array): Promise<string>;
  /** Issues a short-lived download URL for a stored label path. */
  signedUrl(path: string, seconds: number): Promise<string>;
}
