import { Payment, PaymentProps } from '@/payments/domain/entities/payment.entity';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { OrderId } from '@/payments/domain/types/order-id.type';
import { CustomerId } from '@/payments/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { DbPaymentRow } from '@/payments/infrastructure/types/supabase-payment.types';

export class PaymentMapper {
  static toDomain(row: DbPaymentRow): Payment {
    const props: PaymentProps = {
      id: row.id as PaymentId,
      orderId: row.order_id as OrderId,
      tenantId: row.tenant_id as TenantId,
      customerId: row.customer_id as CustomerId,
      status: row.status as PaymentStatus,
      gateway: row.gateway as PaymentGateway,
      amount: Money.from(row.amount_cents / 100, 'USD'), // Assuming amount_cents is saved
      gatewayTransactionId: row.gateway_transaction_id,
      failureReason: row.failure_reason,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
    };

    return Payment.reconstitute(props);
  }

  static toPersistence(entity: Payment): DbPaymentRow {
    return {
      id: entity.getId(),
      order_id: entity.getOrderId(),
      tenant_id: entity.getTenantId(),
      customer_id: entity.getCustomerId(),
      status: entity.getStatus(),
      gateway: entity.getGateway(),
      amount_cents: Math.round(entity.getAmount().getValue() * 100),
      gateway_transaction_id: entity.getGatewayTransactionId(),
      failure_reason: entity.getFailureReason(),
      created_at: entity.getCreatedAt().toISOString(),
      updated_at: entity.getUpdatedAt().toISOString(),
      version: entity.getVersion(),
    };
  }
}
