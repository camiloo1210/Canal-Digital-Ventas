import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidUserIdException } from '@/iam/domain/exceptions/invalid-user-id.exception';

export type UserId = Brand<string, 'UserId'>;

export function createUserId(id: string): UserId {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    throw new InvalidUserIdException();
  }

  return id as UserId;
}
