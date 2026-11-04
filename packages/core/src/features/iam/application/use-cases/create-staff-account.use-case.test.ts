import { describe, expect, it, vi } from 'vitest';
import type { AuthPort } from '@/iam/application/ports/out/auth.port';
import type { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
import { CreateStaffAccountUseCase } from '@/iam/application/use-cases/create-staff-account.use-case';
import { StaffEmailGenerator } from '@/iam/domain/services/staff-email-generator';
import { EmailAlreadyRegisteredException } from '@/iam/application/exceptions/email-already-registered.exception';
import { AdminAuthUnavailableException } from '@/iam/application/exceptions/admin-auth-unavailable.exception';
import { StaffEmailGenerationExhaustedException } from '@/iam/application/exceptions/staff-email-generation-exhausted.exception';

const input = {
  firstName: 'Ana',
  lastName: 'Pérez',
  tenantSlug: 'tienda',
  tenantId: 'tenant-1',
  password: 'secret-123',
};

function counterBytes(): (length: number) => Uint8Array {
  let call = 0;
  return (length: number): Uint8Array => {
    call += 1;
    return new Uint8Array(length).fill(call);
  };
}

function makeAuth(overrides: Partial<AuthPort> = {}): AuthPort {
  return {
    signInWithEmail: vi.fn().mockResolvedValue({ userId: 'u1' }),
    getOAuthSignInUrl: vi.fn(),
    exchangeOAuthCode: vi.fn(),
    signUpWithEmail: vi.fn(),
    signUpWithEmailDetailed: vi.fn().mockResolvedValue({ userId: 'u1', hasSession: true }),
    ...overrides,
  };
}

function makeAdmin(overrides: Partial<AdminAuthPort> = {}): AdminAuthPort {
  return {
    setTenantClaim: vi.fn(),
    createConfirmedUser: vi.fn().mockResolvedValue('u1'),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    setPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function generator(): StaffEmailGenerator {
  return new StaffEmailGenerator(counterBytes());
}

describe('CreateStaffAccountUseCase with the admin key', (): void => {
  it('creates a confirmed user with the generated email and signs in', async (): Promise<void> => {
    const auth = makeAuth();
    const admin = makeAdmin();
    const result = await new CreateStaffAccountUseCase(auth, admin, generator()).execute(input);
    expect(result.userId).toBe('u1');
    expect(result.email).toMatch(/^ana-perez\.[a-z2-7]{6}@tienda\.staff\.invalid$/);
    expect(admin.createConfirmedUser).toHaveBeenCalledWith(result.email, 'secret-123', 'tenant-1');
    expect(auth.signInWithEmail).toHaveBeenCalledWith(result.email, 'secret-123');
    expect(auth.signUpWithEmailDetailed).not.toHaveBeenCalled();
  });

  it('retries with a new suffix when the address already exists', async (): Promise<void> => {
    const createConfirmedUser = vi
      .fn()
      .mockRejectedValueOnce(new EmailAlreadyRegisteredException())
      .mockRejectedValueOnce(new EmailAlreadyRegisteredException())
      .mockResolvedValue('u9');
    const result = await new CreateStaffAccountUseCase(
      makeAuth(),
      makeAdmin({ createConfirmedUser }),
      generator(),
    ).execute(input);
    expect(createConfirmedUser).toHaveBeenCalledTimes(3);
    const emails = createConfirmedUser.mock.calls.map((call: string[]): string => call[0]);
    expect(new Set(emails).size).toBe(3);
    expect(result.email).toBe(emails[2]);
  });

  it('gives up after the maximum attempts', async (): Promise<void> => {
    const admin = makeAdmin({
      createConfirmedUser: vi.fn().mockRejectedValue(new EmailAlreadyRegisteredException()),
    });
    await expect(
      new CreateStaffAccountUseCase(makeAuth(), admin, generator(), 3).execute(input),
    ).rejects.toThrow(StaffEmailGenerationExhaustedException);
    expect(admin.createConfirmedUser).toHaveBeenCalledTimes(3);
  });

  it('does not retry on other failures', async (): Promise<void> => {
    const admin = makeAdmin({ createConfirmedUser: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(
      new CreateStaffAccountUseCase(makeAuth(), admin, generator()).execute(input),
    ).rejects.toThrow('boom');
    expect(admin.createConfirmedUser).toHaveBeenCalledTimes(1);
  });

  it('deletes the created user when the follow-up sign in fails', async (): Promise<void> => {
    const auth = makeAuth({ signInWithEmail: vi.fn().mockRejectedValue(new Error('no session')) });
    const admin = makeAdmin();
    await expect(
      new CreateStaffAccountUseCase(auth, admin, generator()).execute(input),
    ).rejects.toThrow('no session');
    expect(admin.deleteUser).toHaveBeenCalledWith('u1');
  });

  it('rollback deletes the auth user', async (): Promise<void> => {
    const admin = makeAdmin();
    const deleted = await new CreateStaffAccountUseCase(makeAuth(), admin, generator()).rollback(
      'u1',
    );
    expect(deleted).toBe(true);
    expect(admin.deleteUser).toHaveBeenCalledWith('u1');
  });
});

describe('CreateStaffAccountUseCase without the admin key', (): void => {
  it('refuses to create the account: generated emails require the admin port', async (): Promise<void> => {
    const auth = makeAuth();
    await expect(
      new CreateStaffAccountUseCase(auth, null, generator()).execute(input),
    ).rejects.toThrow(AdminAuthUnavailableException);
    expect(auth.signUpWithEmailDetailed).not.toHaveBeenCalled();
    expect(auth.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('rollback cannot delete users without the admin key and says so', async (): Promise<void> => {
    await expect(
      new CreateStaffAccountUseCase(makeAuth(), null, generator()).rollback('u1'),
    ).resolves.toBe(false);
  });
});
