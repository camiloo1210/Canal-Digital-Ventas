import postgres from 'postgres';
import fs from 'fs';

const sql = postgres(process.env.DATABASE_URL);
const migration = fs.readFileSync('../../supabase/migrations/20260923010000_fix_public_storefront_boundary.sql', 'utf8');

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
