import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  PostgresDashboardOverviewReadAdapter,
  type DashboardOverviewReadPort,
  PostgresAdminCatalogReadAdapter,
  type AdminCatalogReadPort,
  PostgresBusinessIntelligenceReadAdapter,
  type BusinessIntelligenceReadPort,
  GenerateBusinessAdviceUseCase,
  GeminiBusinessAdvisorAdapter,
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

/** The Gemini key never leaves the server; without it the use case reports `not_configured`. */
export function getGenerateBusinessAdviceUseCase(): GenerateBusinessAdviceUseCase {
  return new GenerateBusinessAdviceUseCase(
    new PostgresBusinessIntelligenceReadAdapter(sql),
    new GeminiBusinessAdvisorAdapter(
      process.env.GEMINI_API_KEY || undefined,
      process.env.GEMINI_MODEL || undefined,
    ),
  );
}
