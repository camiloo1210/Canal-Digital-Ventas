import { User } from '@/iam/domain/entities/user.entity';
import { UserId } from '@/iam/domain/types/user-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface UserRepositoryPort {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByTenantId(tenantId: TenantId): Promise<User[]>;
  findAll(tenantId: TenantId, pagination?: PaginationOptions): Promise<PaginatedResult<User>>;
}
