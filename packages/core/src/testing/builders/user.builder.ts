import { User, type UserProps } from '@/iam/domain/entities/user.entity';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserStatus } from '@/iam/domain/enums/status.enum';

export const DEFAULT_TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
export const DEFAULT_TEST_USER_TENANT_ID = '22222222-2222-4222-8222-222222222222';

/** Valid, event-free active ADMIN (reconstituted). Deterministic: no clock, no random ids. */
export function buildUser(overrides: Partial<UserProps> = {}): User {
  return User.reconstitute({
    id: createUserId(DEFAULT_TEST_USER_ID),
    tenantId: createTenantId(DEFAULT_TEST_USER_TENANT_ID),
    email: Email.create('user@example.com'),
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    firstName: PersonName.create('Ana'),
    lastName: PersonName.create('Gomez'),
    permissions: [],
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
    version: 0,
    ...overrides,
  });
}
