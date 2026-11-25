import type { LabelStoragePort } from '@/shipment-creation/application/ports/out/label-storage.port';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export const SHIPMENT_LABELS_BUCKET = 'shipment-labels';

/** Minimal slice of the Supabase Storage client this adapter needs (structurally compatible). */
export interface LabelStorageClient {
  from(bucket: string): {
    upload(
      path: string,
      body: Uint8Array,
      options: { readonly contentType: string; readonly upsert: boolean },
    ): Promise<{ readonly error: unknown }>;
    createSignedUrl(
      path: string,
      expiresIn: number,
    ): Promise<{ readonly data: { readonly signedUrl: string } | null; readonly error: unknown }>;
  };
}

export class LabelStorageException extends InfrastructureException {
  public constructor(message: string) {
    super(message);
    this.name = 'LabelStorageException';
  }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LABEL_PATH = new RegExp(`^${UUID}/${UUID}[.]pdf$`);
const TENANT_ID = new RegExp(`^${UUID}$`);
const MAX_LABEL_BYTES = 5242880;
const MAX_SIGNED_URL_SECONDS = 600;

export class SupabaseLabelStorageAdapter implements LabelStoragePort {
  public constructor(
    private readonly storage: LabelStorageClient,
    private readonly newId: () => string = (): string => crypto.randomUUID(),
  ) {}

  public async put(tenantId: string, pdf: Uint8Array): Promise<string> {
    if (!TENANT_ID.test(tenantId) || pdf.byteLength === 0 || pdf.byteLength > MAX_LABEL_BYTES)
      throw new LabelStorageException('Invalid shipment label');
    const path = `${tenantId}/${this.newId()}.pdf`;
    if (!LABEL_PATH.test(path)) throw new LabelStorageException('Invalid shipment label path');
    try {
      const { error } = await this.storage
        .from(SHIPMENT_LABELS_BUCKET)
        .upload(path, pdf, { contentType: 'application/pdf', upsert: false });
      if (error) throw new LabelStorageException('Shipment label upload failed');
      return path;
    } catch (error: unknown) {
      if (error instanceof LabelStorageException) throw error;
      throw new LabelStorageException('Shipment label upload failed');
    }
  }

  public async signedUrl(path: string, seconds: number): Promise<string> {
    if (
      !LABEL_PATH.test(path) ||
      !Number.isSafeInteger(seconds) ||
      seconds < 1 ||
      seconds > MAX_SIGNED_URL_SECONDS
    )
      throw new LabelStorageException('Invalid shipment label request');
    try {
      const { data, error } = await this.storage
        .from(SHIPMENT_LABELS_BUCKET)
        .createSignedUrl(path, seconds);
      if (error || !data?.signedUrl) throw new LabelStorageException('Shipment label link failed');
      return data.signedUrl;
    } catch (error: unknown) {
      if (error instanceof LabelStorageException) throw error;
      throw new LabelStorageException('Shipment label link failed');
    }
  }
}
