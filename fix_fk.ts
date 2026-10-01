import postgres from 'postgres';
import { config } from 'dotenv';
config({ path: './.env.local' });

async function run() {
  const sql = postgres(process.env.DATABASE_URL as string);
  console.log('Fixing foreign key in sales.orders...');
  await sql`ALTER TABLE sales.orders DROP CONSTRAINT orders_customer_id_fkey;`;
  await sql`ALTER TABLE sales.orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES sales.customers(id);`;
  console.log('Done.');
  await sql.end();
}
run();
