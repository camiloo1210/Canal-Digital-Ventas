import { config } from 'dotenv';
config({ path: './.env.local' });
import { GenerateCommercialOrderUseCase } from './packages/core/src/features/orders/application/use-cases/generate-commercial-order.use-case';
import { PostgresOrderRepository } from './packages/core/src/features/orders/infrastructure/repositories/postgres-order.repository';
import { PostgresStoreCustomerRepository } from './packages/core/src/features/sales/infrastructure/repositories/postgres-store-customer.repository';
import { PostgresOrderTenantRepository } from './packages/core/src/features/orders/infrastructure/repositories/postgres-order-tenant.repository';
import { NodePostgresTransactionManager } from './packages/core/src/features/shared/infrastructure/transaction-manager/node-postgres-transaction-manager';
import postgres from 'postgres';

async function run() {
  const sql = postgres(process.env.DATABASE_URL as string);
  const txManager = new NodePostgresTransactionManager(sql);
  
  // Create mock product repository that returns a valid product
  const mockProductRepo = {
    findById: async (id, tenantId) => {
      return {
        getId: () => id,
        getName: () => 'Test Product',
        getStatus: () => 'active',
        getStock: () => 10,
        getPrice: () => ({ getValue: () => 1000, getCurrency: () => 'USD' }),
        getWholesaleMinQuantity: () => null,
        getWholesalePrice: () => null,
        getSku: () => 'SKU-123',
      };
    }
  } as any;

  // Create mock event bus
  const mockEventBus = {
    publish: async () => {}
  } as any;

  const orderRepo = new PostgresOrderRepository(mockEventBus);
  const customerRepo = new PostgresStoreCustomerRepository();
  const tenantRepo = new PostgresOrderTenantRepository();
  
  const useCase = new GenerateCommercialOrderUseCase(
    orderRepo,
    mockProductRepo,
    tenantRepo,
    customerRepo,
    txManager
  );

  // Get a real tenant and real user from DB to avoid FK errors
  const [tenant] = await sql`SELECT id, slug FROM core.tenants LIMIT 1`;
  const [user] = await sql`SELECT id FROM auth.users LIMIT 1`;

  if (!tenant || !user) {
    console.log('No tenant or user found in DB');
    return;
  }

  console.log(`Using tenant ${tenant.slug} and user ${user.id}`);

  try {
    await useCase.execute({
      buyerId: user.id,
      tenantSlug: tenant.slug,
      items: [{ productId: crypto.randomUUID(), quantity: 1 }],
      customer: {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '123456789',
        documentId: 'DOC-123'
      },
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country',
        reference: ''
      }
    });
    console.log('✅ Checkout successful!');
  } catch (error) {
    console.error('❌ Error executing checkout:', error);
  } finally {
    await sql.end();
  }
}

run();
