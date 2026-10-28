import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  PostgresDashboardOverviewReadAdapter,
  type DashboardOverviewReadPort,
  PostgresAdminCatalogReadAdapter,
  type AdminCatalogReadPort,
  PostgresBusinessIntelligenceReadAdapter,
  type BusinessIntelligenceReadPort,
} from '@canaldigital/packages/core';

export function getDashboardOverviewReadRepository(): DashboardOverviewReadPort {
  return new PostgresDashboardOverviewReadAdapter(sql);
}

export function getAdminCatalogReadRepository(): AdminCatalogReadPort {
  return new PostgresAdminCatalogReadAdapter(sql);
}

export function getBusinessIntelligenceReadRepository(): BusinessIntelligenceReadPort {
  return new PostgresBusinessIntelligenceReadAdapter(sql);
}
