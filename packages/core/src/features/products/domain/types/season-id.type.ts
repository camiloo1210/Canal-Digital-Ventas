import { Brand } from '@/shared/domain/types/brand.type';

export type SeasonId = Brand<string, 'SeasonId'>;

import { InvalidSeasonIdException } from '@/products/domain/exceptions/invalid-season-id.exception';
export function createSeasonId(id: string): SeasonId {
  if (!id || id.trim().length === 0) {
    throw new InvalidSeasonIdException();
  }
  return id as SeasonId;
}
