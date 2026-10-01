import postgres from 'postgres';
import { config } from 'dotenv';
config({ path: './.env.local' });

async function run() {
  const sql = postgres(process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres');
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='sales' AND table_name='order_items'`;
  console.log('Columns in sales.order_items:');
  console.log(cols.map(c => c.column_name).join(', '));
  await sql.end();
}
run();
