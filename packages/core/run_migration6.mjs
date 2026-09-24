import postgres from 'postgres';
import fs from 'fs';

const sql = postgres(process.env.DATABASE_URL);
const migration = fs.readFileSync('../../supabase/migrations/20260924000000_tenant_profile_enrichment.sql', 'utf8');

async function run() {
  try {
    await sql.unsafe(migration);
    console.log('Migration executed successfully');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await sql.end();
  }
}

run();
