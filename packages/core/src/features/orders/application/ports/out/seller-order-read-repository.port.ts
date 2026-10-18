import type { SellerOrderPage } from '@/orders/application/read-models/seller-order.read-model';

export interface SellerOrderReadRepositoryPort {
  findBySeller(userId: string, tenantId: string, page: number): Promise<SellerOrderPage>;
}
