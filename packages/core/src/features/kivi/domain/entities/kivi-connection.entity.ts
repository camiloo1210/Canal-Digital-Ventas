import { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';
import type { KiviEncryptedToken } from '@/kivi/domain/value-objects/kivi-encrypted-token';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';

export type KiviConnectionStatus = 'pending' | 'active' | 'needs_reconcile' | 'unlinked';

export interface KiviConnectionProps {
  generation?: number;
  tenantId: string;
  baseUrl: KiviBaseUrl;
  connectionId: string;
  /** Legacy credential source: name of a worker env var. Null for paired connections. */
  secretRef: KiviSecretRef | null;
  /** Paired credential source: the token encrypted at rest. Null for legacy and unlinked. */
  encryptedToken: KiviEncryptedToken | null;
  status: KiviConnectionStatus;
  lastReconciledAt: Date | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Link between one Canal store (tenant) and one Kivi application connection. */
export class KiviConnection {
  private props: KiviConnectionProps;

  private constructor(props: KiviConnectionProps) {
    if (!Number.isSafeInteger(props.generation ?? 0) || (props.generation ?? 0) < 0) {
      throw new InvalidKiviConnectionException('The synchronization generation is invalid.');
    }
    if (!UUID.test(props.tenantId) || !UUID.test(props.connectionId)) {
      throw new InvalidKiviConnectionException('Store and Kivi connection ids must be UUIDs.');
    }
    if (!['pending', 'active', 'needs_reconcile', 'unlinked'].includes(props.status)) {
      throw new InvalidKiviConnectionException('The Kivi connection status is invalid.');
    }
    const encrypted = props.encryptedToken;
    if (
      encrypted &&
      (!encrypted.ciphertext.trim() ||
        !Number.isInteger(encrypted.keyVersion) ||
        encrypted.keyVersion < 1 ||
        encrypted.keyVersion > 32767)
    ) {
      throw new InvalidKiviConnectionException('The encrypted Kivi credential is invalid.');
    }
    if (
      props.status === 'unlinked'
        ? encrypted !== null
        : Boolean(props.secretRef) === Boolean(encrypted)
    ) {
      throw new InvalidKiviConnectionException(
        'The Kivi connection has inconsistent credential sources.',
      );
    }
    this.assertDate(props.lastReconciledAt);
    this.props = {
      ...props,
      encryptedToken: encrypted ? { ...encrypted } : null,
      lastReconciledAt: props.lastReconciledAt ? new Date(props.lastReconciledAt) : null,
    };
  }

  private assertDate(at: Date | null): void {
    if (at && !Number.isFinite(at.getTime())) {
      throw new InvalidKiviConnectionException('The reconciliation date is invalid.');
    }
  }

  public static link(input: {
    tenantId: string;
    baseUrl: KiviBaseUrl;
    connectionId: string;
    secretRef: KiviSecretRef;
  }): KiviConnection {
    if (!UUID.test(input.tenantId) || !UUID.test(input.connectionId)) {
      throw new InvalidKiviConnectionException('Store and Kivi connection ids must be UUIDs.');
    }
    return new KiviConnection({
      ...input,
      encryptedToken: null,
      status: 'pending',
      lastReconciledAt: null,
    });
  }

  /** Pairing flow: the credential is the encrypted token Kivi issued for this store. */
  public static pair(input: {
    tenantId: string;
    baseUrl: KiviBaseUrl;
    connectionId: string;
    encryptedToken: KiviEncryptedToken;
  }): KiviConnection {
    if (!UUID.test(input.tenantId) || !UUID.test(input.connectionId)) {
      throw new InvalidKiviConnectionException('Store and Kivi connection ids must be UUIDs.');
    }
    if (!input.encryptedToken.ciphertext) {
      throw new InvalidKiviConnectionException('A paired connection needs its encrypted token.');
    }
    return new KiviConnection({
      ...input,
      secretRef: null,
      status: 'pending',
      lastReconciledAt: null,
    });
  }

  public static reconstitute(props: KiviConnectionProps): KiviConnection {
    return new KiviConnection({ ...props });
  }

  public completeInitialLoad(at: Date): void {
    this.assertLinked();
    this.assertDate(at);
    this.props.status = 'active';
    this.props.lastReconciledAt = new Date(at);
  }

  public flagNeedsReconcile(): void {
    this.assertLinked();
    if (this.props.status === 'pending') return;
    this.props.status = 'needs_reconcile';
  }

  public markReconciled(at: Date): void {
    this.assertLinked();
    this.assertDate(at);
    this.props.status = 'active';
    this.props.lastReconciledAt = new Date(at);
  }

  public unlink(): void {
    this.assertLinked();
    this.props.status = 'unlinked';
    this.props.encryptedToken = null;
  }

  public isSyncing(): boolean {
    return this.props.status !== 'unlinked';
  }

  private assertLinked(): void {
    if (this.props.status === 'unlinked') {
      throw new InvalidKiviConnectionException('The Kivi connection is unlinked.');
    }
  }

  public getTenantId(): string {
    return this.props.tenantId;
  }
  public getGeneration(): number {
    return this.props.generation ?? 0;
  }
  public getBaseUrl(): KiviBaseUrl {
    return this.props.baseUrl;
  }
  public getConnectionId(): string {
    return this.props.connectionId;
  }
  public getSecretRef(): KiviSecretRef | null {
    return this.props.secretRef;
  }
  public getEncryptedToken(): KiviEncryptedToken | null {
    return this.props.encryptedToken ? { ...this.props.encryptedToken } : null;
  }
  public getStatus(): KiviConnectionStatus {
    return this.props.status;
  }
  public getLastReconciledAt(): Date | null {
    return this.props.lastReconciledAt ? new Date(this.props.lastReconciledAt) : null;
  }
}
