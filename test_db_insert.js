const postgres = require('postgres');

async function test() {
  const sql = postgres('postgres://postgres:postgres@127.0.0.1:54322/postgres');
  try {
    await sql`SELECT 1 FROM public.orders`;
    console.log("public.orders exists");
  } catch(e) {
    console.error("public.orders error:", e.message);
  }
  
  try {
    await sql`SELECT 1 FROM sales.orders`;
    console.log("sales.orders exists");
  } catch(e) {
    console.error("sales.orders error:", e.message);
  }
  
  process.exit(0);
}

test();
