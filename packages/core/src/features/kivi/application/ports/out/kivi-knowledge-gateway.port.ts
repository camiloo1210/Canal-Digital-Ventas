import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

/** Mirrors Kivi's external resource lifecycle; failure details are deliberately not exposed. */
export type KiviKnowledgeStatus = 'pending' | 'indexed' | 'failed' | 'deleted';

export interface KiviKnowledgeResource {
  kind: string;
  externalId: string;
  version: number;
  status: KiviKnowledgeStatus;
  updatedAt: string;
  indexedAt: string | null;
}

export interface KiviKnowledgeContent {
  title: string;
  content: string;
}

export interface KiviKnowledgeGatewayPort {
  list(target: KiviTarget): Promise<KiviKnowledgeResource[]>;
  put(
    target: KiviTarget,
    kind: string,
    externalId: string,
    version: number,
    input: KiviKnowledgeContent,
  ): Promise<KiviKnowledgeResource>;
  remove(
    target: KiviTarget,
    kind: string,
    externalId: string,
    version: number,
  ): Promise<KiviKnowledgeResource>;
  retry(target: KiviTarget, kind: string, externalId: string): Promise<KiviKnowledgeResource>;
}

export interface KiviKnowledgeReadPort {
  /** Owner-only; throws when the store is not linked. Deleted resources are omitted. */
  findForOwner(userId: string, tenantId: string): Promise<KiviKnowledgeResource[]>;
}
