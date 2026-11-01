import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';

export async function resolveKiviOwnerTarget(
  repository: KiviConnectionRepositoryPort,
  transactions: TransactionManagerPort,
  secrets: KiviSecretResolverPort,
  userId: string,
  tenantId: string,
): Promise<KiviTarget> {
  return transactions.runInTransaction(
    async (tx): Promise<KiviTarget> => {
      if (!(await repository.isStoreOwner(userId, tenantId, tx)))
        throw new KiviLinkForbiddenException();
      const connection = await repository.findByTenant(tenantId, tx);
      if (!connection || !connection.isSyncing()) throw new KiviConnectionNotFoundException();
      const token = secrets.resolve(connection);
      if (!token) throw new KiviGatewayException('rejected', 401);
      return {
        baseUrl: connection.getBaseUrl().getValue(),
        connectionId: connection.getConnectionId(),
        token,
      };
    },
    { userId, tenantId },
  );
}
