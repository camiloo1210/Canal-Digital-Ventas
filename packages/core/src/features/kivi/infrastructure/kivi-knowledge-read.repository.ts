import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type {
  KiviKnowledgeGatewayPort,
  KiviKnowledgeReadPort,
  KiviKnowledgeResource,
} from '@/kivi/application/ports/out/kivi-knowledge-gateway.port';
import { resolveKiviOwnerTarget } from '@/kivi/application/kivi-owner-target';
import { KIVI_KNOWLEDGE_KIND } from '@/kivi/application/use-cases/configure-kivi-knowledge.use-case';

export class KiviKnowledgeReadRepository implements KiviKnowledgeReadPort {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly secrets: KiviSecretResolverPort,
    private readonly gateway: KiviKnowledgeGatewayPort,
  ) {}

  public async findForOwner(userId: string, tenantId: string): Promise<KiviKnowledgeResource[]> {
    const target = await resolveKiviOwnerTarget(
      this.repository,
      this.transactions,
      this.secrets,
      userId,
      tenantId,
    );
    return (await this.gateway.list(target)).filter(
      (resource): boolean => resource.kind === KIVI_KNOWLEDGE_KIND && resource.status !== 'deleted',
    );
  }
}
