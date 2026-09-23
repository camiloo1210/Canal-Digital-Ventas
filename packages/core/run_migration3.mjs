import postgres from 'postgres';
import fs from 'fs';

const sql = postgres(process.env.DATABASE_URL);
const migration = fs.readFileSync('../../supabase/migrations/20260923030000_move_rpcs_to_public.sql', 'utf8');

async function run() {
  try {
    await sql.unsafe(migration);
    console.log('Migration 3 executed successfully');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await sql.end();
  }
}

run();
