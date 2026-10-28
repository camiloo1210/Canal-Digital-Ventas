export type KiviConnectionViewStatus = 'pending' | 'active' | 'needs_reconcile';

/** Owner-facing projection. Exposes no credential, reference or ciphertext. */
export interface KiviConnectionReadModel {
  baseUrl: string;
  connectionId: string;
  /** 'paired' = token issued through the pairing code; 'legacy' = worker env-var token. */
  source: 'paired' | 'legacy';
  status: KiviConnectionViewStatus;
  lastReconciledAt: string | null;
}

export interface KiviConnectionReadRepositoryPort {
  /** Null for non-owners, unknown stores and unlinked connections. */
  findForOwner(userId: string, tenantId: string): Promise<KiviConnectionReadModel | null>;
}
