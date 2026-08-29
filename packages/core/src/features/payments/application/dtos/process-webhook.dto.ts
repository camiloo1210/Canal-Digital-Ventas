import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { TenantId } from '@/payments/domain/types/tenant-id.type';

export interface ProcessWebhookDto {
  gateway: PaymentGateway;
  payload: string;
  signature: string;
  tenantId: TenantId;
}
