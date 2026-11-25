import type { ShippingOriginRepositoryPort } from '@/tenants/application/ports/out/shipping-origin-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { ShippingOriginForbiddenException } from '@/tenants/application/exceptions/shipping-origin-forbidden.exception';
import {
  ShippingOrigin,
  type ShippingOriginProps,
} from '@/tenants/domain/value-objects/shipping-origin.vo';

export interface SaveShippingOriginDto extends ShippingOriginProps {
  tenantId: string;
  authenticatedUserId: string;
}

export class SaveShippingOriginUseCase {
  public constructor(
    private readonly repository: ShippingOriginRepositoryPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: SaveShippingOriginDto): Promise<void> {
    const origin = ShippingOrigin.create({
      contactName: dto.contactName,
      phone: dto.phone,
      street: dto.street,
      city: dto.city,
      state: dto.state,
      zipCode: dto.zipCode,
      country: dto.country,
    });
    await this.transactions.runInTransaction(
      async (tx): Promise<void> => {
        if (!(await this.repository.canManageStore(dto.authenticatedUserId, dto.tenantId, tx))) {
          throw new ShippingOriginForbiddenException();
        }
        await this.repository.save(dto.tenantId, origin, tx);
      },
      { userId: dto.authenticatedUserId, tenantId: dto.tenantId },
    );
  }
}
