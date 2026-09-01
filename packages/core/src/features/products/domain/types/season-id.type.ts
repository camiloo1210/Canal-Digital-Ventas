import { Brand } from '@/shared/domain/types/brand.type';

export type SeasonId = Brand<string, 'SeasonId'>;

export function createSeasonId(id: string): SeasonId {
  if (!id || id.trim().length === 0) {
    throw new Error('SeasonId cannot be empty');
  }
  return id as SeasonId;
}
