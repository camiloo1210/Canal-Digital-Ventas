import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type {
  KiviKnowledgeContent,
  KiviKnowledgeGatewayPort,
  KiviKnowledgeResource,
  KiviKnowledgeStatus,
} from '@/kivi/application/ports/out/kivi-knowledge-gateway.port';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { HttpKiviCatalogGateway } from '@/kivi/infrastructure/http-kivi-catalog.gateway';

const KIND = /^[a-zA-Z0-9_-]{1,64}$/;
const EXTERNAL_ID = /^[a-zA-Z0-9_.:@-]{1,200}$/;
const STATUSES: readonly string[] = ['pending', 'indexed', 'failed', 'deleted'];
const PAGE_SIZE = 100;

/** Kivi knowledge resources (RAG sources) over the application connection API. */
export class HttpKiviKnowledgeGateway
  extends HttpKiviCatalogGateway
  implements KiviKnowledgeGatewayPort
{
  public async list(target: KiviTarget): Promise<KiviKnowledgeResource[]> {
    const body = await this.request(target, 'GET', `/resources?limit=${PAGE_SIZE}`);
    if (!Array.isArray(body)) throw new KiviGatewayException('transient', 200);
    return body.map((row: unknown): KiviKnowledgeResource => this.parse(row));
  }

  public async put(
    target: KiviTarget,
    kind: string,
    externalId: string,
    version: number,
    input: KiviKnowledgeContent,
  ): Promise<KiviKnowledgeResource> {
    if (!Number.isSafeInteger(version) || version < 1)
      throw new KiviGatewayException('rejected', 0);
    return this.parse(
      await this.request(target, 'PUT', this.path(kind, externalId), {
        version,
        title: input.title,
        content: input.content,
      }),
    );
  }

  public async remove(
    target: KiviTarget,
    kind: string,
    externalId: string,
    version: number,
  ): Promise<KiviKnowledgeResource> {
    if (!Number.isSafeInteger(version) || version < 1)
      throw new KiviGatewayException('rejected', 0);
    return this.parse(
      await this.request(target, 'DELETE', `${this.path(kind, externalId)}?version=${version}`),
    );
  }

  public async retry(
    target: KiviTarget,
    kind: string,
    externalId: string,
  ): Promise<KiviKnowledgeResource> {
    return this.parse(await this.request(target, 'POST', `${this.path(kind, externalId)}/retry`));
  }

  private path(kind: string, externalId: string): string {
    if (
      !KIND.test(kind) ||
      !EXTERNAL_ID.test(externalId) ||
      externalId === '.' ||
      externalId === '..'
    )
      throw new KiviGatewayException('rejected', 0);
    return `/resources/${encodeURIComponent(kind)}/${encodeURIComponent(externalId)}`;
  }

  private parse(row: unknown): KiviKnowledgeResource {
    if (
      typeof row !== 'object' ||
      row === null ||
      !('kind' in row) ||
      typeof row.kind !== 'string' ||
      !KIND.test(row.kind) ||
      !('external_id' in row) ||
      typeof row.external_id !== 'string' ||
      !EXTERNAL_ID.test(row.external_id) ||
      !('version' in row) ||
      typeof row.version !== 'number' ||
      !Number.isSafeInteger(row.version) ||
      row.version < 1 ||
      !('status' in row) ||
      typeof row.status !== 'string' ||
      !STATUSES.includes(row.status) ||
      !('updated_at' in row) ||
      typeof row.updated_at !== 'string' ||
      !Number.isFinite(Date.parse(row.updated_at))
    )
      throw new KiviGatewayException('transient', 200);
    const indexedAt =
      'indexed_at' in row && typeof row.indexed_at === 'string' ? row.indexed_at : null;
    return {
      kind: row.kind,
      externalId: row.external_id,
      version: row.version,
      status: row.status as KiviKnowledgeStatus,
      updatedAt: row.updated_at,
      indexedAt: indexedAt !== null && Number.isFinite(Date.parse(indexedAt)) ? indexedAt : null,
    };
  }
}
