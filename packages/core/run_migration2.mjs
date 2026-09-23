import postgres from 'postgres';
import fs from 'fs';

const sql = postgres(process.env.DATABASE_URL);
const migration = fs.readFileSync('../../supabase/migrations/20260923020000_public_active_tenants_rpc.sql', 'utf8');

async function run() {
  try {
    await sql.unsafe(migration);
    console.log('Migration 2 executed successfully');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await sql.end();
  }
}

run();
