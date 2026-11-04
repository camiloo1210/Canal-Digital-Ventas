import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  PostgresBusinessAccountReadRepository,
  type BusinessAccountReadPort,
} from '@canaldigital/packages/core';

/** Early, friendly check of the single-company rule for business accounts (the DB trigger decides). */
export function getBusinessAccountReadRepository(): BusinessAccountReadPort {
  return new PostgresBusinessAccountReadRepository(sql);
}
