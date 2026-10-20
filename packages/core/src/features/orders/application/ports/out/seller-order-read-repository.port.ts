import type {
  SellerOrderPage,
  SellerOrderFilters,
} from '@/orders/application/read-models/seller-order.read-model';

export interface SellerOrderReadRepositoryPort {
  findBySeller(
    userId: string,
    tenantId: string,
    page: number,
    filters?: SellerOrderFilters,
  ): Promise<SellerOrderPage>;
}
