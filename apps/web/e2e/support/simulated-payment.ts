import postgres from 'postgres';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function localDatabaseUrl(): string {
  const value = process.env.E2E_DATABASE_URL ?? '';
  let hostname: string;
  try {
    hostname = new URL(value).hostname;
  } catch {
    throw new Error('E2E_DATABASE_URL is missing or invalid (set by playwright.config.ts).');
  }
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error('Refusing to simulate a payment: E2E_DATABASE_URL must be local.');
  }
  return value;
}

/**
 * PAYMENT IS SIMULATED, NOT TESTED. Lemon Squeezy checkout, webhook and payment workers are not
 * exercised. This marks the store's confirmed orders as paid and records a completed payment
 * (gateway `bank_transfer`, never `lemon_squeezy`) directly in the local database, because the
 * fulfillment rules require a settled payment. That lets the logistics steps (processing, shipped,
 * delivered) be driven through the UI. Returns how many orders were updated.
 */
export async function markConfirmedOrdersPaidWithoutPayment(storeSlug: string): Promise<number> {
  const sql = postgres(localDatabaseUrl(), { max: 1, prepare: false, connect_timeout: 10 });
  try {
    return await sql.begin(async (tx): Promise<number> => {
      const orders = await tx<
        {
          id: string;
          tenant_id: string;
          customer_id: string;
          total_amount_cents: number;
          currency: string;
        }[]
      >`
        UPDATE sales.orders o
        SET status = 'paid', version = o.version + 1, updated_at = now()
        FROM core.tenants t
        WHERE t.id = o.tenant_id AND t.slug = ${storeSlug} AND o.status = 'confirmed'
        RETURNING o.id, o.tenant_id, o.customer_id, o.total_amount_cents, o.currency`;
      for (const order of orders) {
        await tx`
          INSERT INTO sales.payments
            (id, order_id, tenant_id, customer_id, status, gateway, amount_cents, currency, environment, store_id, checkout_expires_at)
          VALUES
            (gen_random_uuid(), ${order.id}, ${order.tenant_id}, ${order.customer_id}, 'completed',
             'bank_transfer', ${order.total_amount_cents}, ${order.currency}, 'test', 'e2e-simulated', now())`;
      }
      return orders.length;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
