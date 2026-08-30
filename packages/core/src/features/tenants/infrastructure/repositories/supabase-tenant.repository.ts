import { SupabaseClient } from '@supabase/supabase-js';
import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { TenantId } from '@/tenants/domain/types/tenant-id.type';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import {
  TenantRepositoryPort,
  TenantFilters,
} from '@/tenants/application/ports/out/tenant-repository.port';
import { SupabaseTenantMapper } from '@/tenants/infrastructure/mappers/supabase-tenant.mapper';
import { DbTenantRow } from '@/tenants/infrastructure/types/supabase-tenant.types';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { TenantRepositoryException } from '@/tenants/infrastructure/exceptions/tenant-repository.exception';

export class SupabaseTenantRepository implements TenantRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(tenant: Tenant): Promise<void> {
    const tenantRow = SupabaseTenantMapper.toPersistence(tenant);

    const { error } = await this.supabase.from('tenants').insert(tenantRow);

    if (error) {
      throw new TenantRepositoryException(`Failed to save tenant: ${error.message}`);
    }
  }

  async update(tenant: Tenant): Promise<void> {
    const tenantRow = SupabaseTenantMapper.toPersistence(tenant);
    // Optimistic locking assuming version is incremented in the entity
    const previousVersion = tenant.getVersion() - 1;

    const { data, error } = await this.supabase
      .from('tenants')
      .update(tenantRow)
      .eq('id', tenant.getId())
      .eq('version', previousVersion)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new TenantRepositoryException(`Failed to update tenant: ${error.message}`);
    }

    if (!data) {
      throw new TenantRepositoryException(
        `Optimistic locking failed: the tenant has been updated by another transaction or does not exist.`,
      );
    }
  }

  async delete(tenantId: TenantId): Promise<void> {
    // Hard delete
    const { error } = await this.supabase.from('tenants').delete().eq('id', tenantId);

    if (error) {
      throw new TenantRepositoryException(`Failed to delete tenant: ${error.message}`);
    }
  }

  async findById(id: TenantId): Promise<Tenant | null> {
    const { data, error } = await this.supabase.from('tenants').select('*').eq('id', id).single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        throw new TenantRepositoryException(`Database error searching tenant: ${error.message}`);
      }
      return null;
    }

    return SupabaseTenantMapper.toDomain(data as DbTenantRow);
  }

  async findBySlug(slug: TenantSlug): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug.getValue())
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        throw new TenantRepositoryException(
          `Database error searching tenant by slug: ${error.message}`,
        );
      }
      return null;
    }

    return SupabaseTenantMapper.toDomain(data as DbTenantRow);
  }

  async findAll(
    filters: TenantFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Tenant>> {
    return this.searchByFilters(filters, pagination);
  }

  async searchByFilters(
    filters: TenantFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Tenant>> {
    let query = this.supabase
      .from('tenants')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.id) {
      query = query.eq('id', filters.id);
    }

    if (filters.slug) {
      query = query.eq('slug', filters.slug.getValue());
    }

    if (filters.name) {
      query = query.ilike('name', `%${filters.name.getValue()}%`);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new TenantRepositoryException(`Failed to search tenants: ${error.message}`);
    }

    const totalItems = count ?? 0;
    const tenants = (data ?? []).map((row) => SupabaseTenantMapper.toDomain(row as DbTenantRow));

    return {
      items: tenants,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}
