import { BuyerOrderReadModel } from '@/orders/application/read-models/buyer-order.read-model';

export interface BuyerOrderReadRepositoryPort {
  findOrdersByBuyerId(buyerAuthId: string): Promise<BuyerOrderReadModel[]>;
}
