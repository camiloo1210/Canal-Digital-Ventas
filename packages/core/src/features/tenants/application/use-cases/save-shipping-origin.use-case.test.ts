import { describe, it, expect, vi } from 'vitest';
import { SaveShippingOriginUseCase } from '@/tenants/application/use-cases/save-shipping-origin.use-case';
import { ShippingOriginForbiddenException } from '@/tenants/application/exceptions/shipping-origin-forbidden.exception';
import { InvalidShippingOriginException } from '@/tenants/domain/exceptions/invalid-shipping-origin.exception';
import type { ShippingOriginRepositoryPort } from '@/tenants/application/ports/out/shipping-origin-repository.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

const dto = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  authenticatedUserId: '22222222-2222-4222-8222-222222222222',
  contactName: 'Ana',
  phone: '300',
  street: 'Calle 1',
  city: 'Bogota',
  state: 'DC',
  zipCode: '110111',
  country: 'CO',
};

function setup(allowed: boolean): {
  useCase: SaveShippingOriginUseCase;
  save: ReturnType<typeof vi.fn>;
} {
  const save = vi.fn().mockResolvedValue(undefined);
  const repository: ShippingOriginRepositoryPort = {
    canManageStore: vi.fn().mockResolvedValue(allowed),
    save,
    find: vi.fn(),
  };
  const tx: TransactionContext = { executeNative: vi.fn() };
  const transactions: TransactionManagerPort = {
    runInTransaction: async <T>(op: (c: TransactionContext) => Promise<T>): Promise<T> => op(tx),
  };
  return { useCase: new SaveShippingOriginUseCase(repository, transactions), save };
}

describe('SaveShippingOriginUseCase', (): void => {
  it('saves for a member who manages the store', async (): Promise<void> => {
    const { useCase, save } = setup(true);
    await useCase.execute(dto);
    expect(save).toHaveBeenCalledWith(dto.tenantId, expect.anything(), expect.anything());
  });
  it('rejects a user without permission', async (): Promise<void> => {
    const { useCase, save } = setup(false);
    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(ShippingOriginForbiddenException);
    expect(save).not.toHaveBeenCalled();
  });
  it('rejects an invalid origin before saving', async (): Promise<void> => {
    const { useCase, save } = setup(true);
    await expect(useCase.execute({ ...dto, country: 'col' })).rejects.toBeInstanceOf(
      InvalidShippingOriginException,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
