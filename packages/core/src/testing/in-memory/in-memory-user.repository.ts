import { User, type UserProps } from '@/iam/domain/entities/user.entity';
import type { UserId } from '@/iam/domain/types/user-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import type { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import type { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

function snapshotOf(user: User): UserProps {
  return {
    id: user.getId(),
    tenantId: user.getTenantId(),
    email: user.getEmail(),
    role: user.getRole(),
    status: user.getStatus(),
    firstName: user.getFirstName(),
    lastName: user.getLastName(),
    permissions: user.getPermissions(),
    createdAt: new Date(user.getCreatedAt()),
    updatedAt: new Date(user.getUpdatedAt()),
    version: user.getVersion(),
  };
}

/**
 * In-memory user repository. Stores snapshots: `save` copies, every read returns a fresh
 * instance without domain events, so unsaved mutations never leak into the store.
 * Mirrors the port: `findById` is NOT tenant scoped (the port has no tenant parameter);
 * `findByTenantId` and `findAll` are. Insertion order is the listing order.
 */
export class InMemoryUserRepository implements UserRepositoryPort {
  private readonly store = new Map<string, UserProps>();
  public saveCount = 0;

  /** Test setup helper: stores a snapshot without counting as a `save`. */
  public seed(...users: User[]): void {
    for (const user of users) this.store.set(user.getId(), snapshotOf(user));
  }

  private inTenant(tenantId: TenantId): User[] {
    return [...this.store.values()]
      .filter((props): boolean => props.tenantId === tenantId)
      .map((props): User => User.reconstitute(props));
  }

  async save(user: User): Promise<void> {
    this.saveCount++;
    this.seed(user);
  }

  // Deliberately not tenant scoped (matches the port). Do not "fix": the use-case IDOR
  // it.fails tests rely on this.
  async findById(id: UserId): Promise<User | null> {
    const props = this.store.get(id);
    return props ? User.reconstitute(props) : null;
  }

  async findByTenantId(tenantId: TenantId): Promise<User[]> {
    return this.inTenant(tenantId);
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<User>> {
    const items = this.inTenant(tenantId);
    if (!pagination) {
      return { items, totalItems: items.length, totalPages: 1, currentPage: 1 };
    }
    const start = (pagination.page - 1) * pagination.limit;
    return {
      items: items.slice(start, start + pagination.limit),
      totalItems: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / pagination.limit)),
      currentPage: pagination.page,
    };
  }
}
