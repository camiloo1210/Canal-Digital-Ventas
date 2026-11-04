import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type {
  KiviKnowledgeGatewayPort,
  KiviKnowledgeResource,
} from '@/kivi/application/ports/out/kivi-knowledge-gateway.port';
import { resolveKiviOwnerTarget } from '@/kivi/application/kivi-owner-target';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { KiviKnowledgeLimitException } from '@/kivi/application/exceptions/kivi-knowledge-limit.exception';

/** Resource kind Canal publishes into Kivi's knowledge base. */
export const KIVI_KNOWLEDGE_KIND = 'document';
export const KIVI_KNOWLEDGE_MAX_DOCUMENTS = 50;

/**
 * Kivi's resource listing omits titles, so the readable title travels in the document id:
 * `<slug>.<8 hex>`. The slug is lossy (lowercase, no accents) and is only used for display.
 */
export function kiviKnowledgeDocumentId(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return `${slug || 'documento'}.${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

export function kiviKnowledgeDisplayName(externalId: string): string {
  const dot = externalId.lastIndexOf('.');
  const slug = dot > 0 ? externalId.slice(0, dot) : externalId;
  return slug.replace(/-/g, ' ');
}

export interface ConfigureKiviKnowledgeDto {
  userId: string;
  tenantId: string;
  operation: 'upload' | 'delete' | 'retry';
  /** Existing document to replace/delete/retry; empty on upload creates a new document. */
  documentId: string;
  title: string;
  content: string;
}

export class ConfigureKiviKnowledgeUseCase {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly secrets: KiviSecretResolverPort,
    private readonly gateway: KiviKnowledgeGatewayPort,
    private readonly newDocumentId: (title: string) => string = kiviKnowledgeDocumentId,
  ) {}

  public async execute(dto: ConfigureKiviKnowledgeDto): Promise<KiviKnowledgeResource> {
    const target = await resolveKiviOwnerTarget(
      this.repository,
      this.transactions,
      this.secrets,
      dto.userId,
      dto.tenantId,
    );
    // Kivi owns versioning (strictly increasing per resource); never hold SQL over HTTP.
    const documents = (await this.gateway.list(target)).filter(
      (resource): boolean => resource.kind === KIVI_KNOWLEDGE_KIND,
    );
    const current = documents.find((resource): boolean => resource.externalId === dto.documentId);
    if (dto.operation === 'retry') {
      if (!current) throw new KiviGatewayException('rejected', 404);
      return this.gateway.retry(target, KIVI_KNOWLEDGE_KIND, current.externalId);
    }
    if (dto.operation === 'delete') {
      if (!current) throw new KiviGatewayException('rejected', 404);
      return this.gateway.remove(
        target,
        KIVI_KNOWLEDGE_KIND,
        current.externalId,
        current.version + 1,
      );
    }
    if (
      !current &&
      documents.filter((r): boolean => r.status !== 'deleted').length >=
        KIVI_KNOWLEDGE_MAX_DOCUMENTS
    )
      throw new KiviKnowledgeLimitException(KIVI_KNOWLEDGE_MAX_DOCUMENTS);
    return this.gateway.put(
      target,
      KIVI_KNOWLEDGE_KIND,
      current ? current.externalId : this.newDocumentId(dto.title),
      current ? current.version + 1 : 1,
      { title: dto.title, content: dto.content },
    );
  }
}
