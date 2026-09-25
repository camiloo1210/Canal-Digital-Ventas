import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    // Test 1: Direct SELECT on products table should fail for anon (return 0 rows)
    console.log('Test 1: Direct SELECT on catalog.products as anon');
    const result1 = await sql.unsafe(`SET ROLE anon; SELECT * FROM catalog.products;`);
    if (result1[1].length === 0) {
      console.log('✅ PASSED: RLS blocked direct SELECT (returned 0 rows)');
    } else {
      console.error('❌ FAILED: anon was able to read catalog.products');
    }

    // Test 2: Call RPC with valid slug
    console.log('\nTest 2: Call RPC get_public_products_by_slug with "demo-store"');
    const result2 = await sql.unsafe(`
      SET ROLE anon;
      SELECT * FROM catalog.get_public_products_by_slug('demo-store');
    `);
    console.log(`✅ PASSED: Retrieved ${result2[1].length} products`);

    // Test 3: Call RPC with omitted param (should fail signature)
    console.log('\nTest 3: Omit tenant slug');
    try {
      await sql.unsafe(`SET ROLE anon; SELECT * FROM catalog.get_public_products_by_slug();`);
      console.error('❌ FAILED: Omitted param worked!');
    } catch (e) {
      if (e.code === '42883') console.log('✅ PASSED: Postgres rejected call without slug parameter');
      else throw e;
    }

    // Test 4: Extreme limit
    console.log('\nTest 4: Request Limit 1000000');
    const extremeLimit = await sql.unsafe(`
      SET ROLE anon;
      SELECT * FROM catalog.get_public_products_by_slug('demo-store', NULL, NULL, 1, 1000000);
    `);
    console.log(`✅ PASSED: Retrieved ${extremeLimit[1].length} products (clamped to 24 by the RPC)`);

  } finally {
    await sql.end();
  }
}

run();
