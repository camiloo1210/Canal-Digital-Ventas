import { SupabaseClient } from '@supabase/supabase-js';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { User } from '@/iam/domain/entities/user.entity';
import { SupabaseUserMapper } from '@/iam/infrastructure/mappers/supabase-user.mapper';
import { DbUserRow } from '@/iam/infrastructure/types/supabase-user.types';
import { UserId } from '@/iam/domain/types/user-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
import { UserRepositoryException } from '@/iam/infrastructure/exceptions/user-repository.exception';

export class SupabaseUserRepository implements UserRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(user: User): Promise<void> {
    const userRow = SupabaseUserMapper.toPersistence(user);

    const { error } = await this.supabase.rpc('upsert_user_transactional', {
      user_data: userRow,
    });

    if (error) {
      if (error.code === 'P0001') {
        throw new UserRepositoryException(
          `Optimistic locking failed: the user has been updated by another transaction.`,
        );
      }
      throw new UserRepositoryException(`Failed to save user transactionally: ${error.message}`);
    }
  }

  async findById(id: UserId): Promise<User | null> {
    const { data, error } = await this.supabase.from('users').select('*').eq('id', id).single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        throw new UserRepositoryException(`Database error searching user: ${error.message}`);
      }
      return null;
    }

    return SupabaseUserMapper.toDomain(data as DbUserRow);
  }

  async findByTenantId(tenantId: TenantId): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new UserRepositoryException(
        `Database error searching users by tenant: ${error.message}`,
      );
    }

    return (data || []).map((row) => SupabaseUserMapper.toDomain(row as DbUserRow));
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<User>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      throw new UserRepositoryException(`Failed to get users: ${error.message}`);
    }

    const totalItems = count ?? 0;
    const users = (data ?? []).map((row) => SupabaseUserMapper.toDomain(row as DbUserRow));

    return {
      items: users,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}
