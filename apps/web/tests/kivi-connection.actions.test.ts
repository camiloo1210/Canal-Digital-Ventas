import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pairKiviAction,
  requestKiviSyncAction,
  unlinkKiviAction,
  type KiviConnectionActionState,
} from '@/features/kivi/actions/kivi-connection.actions';
import {
  getPairStoreWithKiviUseCase,
  getRequestKiviSyncUseCase,
  getUnlinkStoreFromKiviUseCase,
} from '@/features/kivi/di/kivi.di';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { revalidatePath } from 'next/cache';
import {
  InvalidKiviPairingCodeException,
  KiviConfigurationException,
  KiviConnectionNotFoundException,
  KiviLinkForbiddenException,
  KiviPairingException,
} from '@canaldigital/packages/core';

vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveTenantQuery: vi.fn(),
}));
vi.mock('@/features/kivi/di/kivi.di', (): object => ({
  getPairStoreWithKiviUseCase: vi.fn(),
  getUnlinkStoreFromKiviUseCase: vi.fn(),
  getRequestKiviSyncUseCase: vi.fn(),
}));

const actor = crypto.randomUUID();
const activeTenant = crypto.randomUUID();
const CODE = 'kvp_' + 'c'.repeat(32);
const initial: KiviConnectionActionState = { success: false, message: null };

const pair = vi.fn();
const unlink = vi.fn();
const sync = vi.fn();

function pairForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set('code', CODE);
  for (const [key, value] of Object.entries(overrides)) data.set(key, value);
  return data;
}

describe('Kivi connection actions', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    pair.mockReset().mockResolvedValue(undefined);
    unlink.mockReset().mockResolvedValue(undefined);
    sync.mockReset().mockResolvedValue(undefined);
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actor } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(getActiveTenantQuery).mockResolvedValue(
      activeTenant as Awaited<ReturnType<typeof getActiveTenantQuery>>,
    );
    vi.mocked(getPairStoreWithKiviUseCase).mockReturnValue({
      execute: pair,
    } as unknown as ReturnType<typeof getPairStoreWithKiviUseCase>);
    vi.mocked(getUnlinkStoreFromKiviUseCase).mockReturnValue({
      execute: unlink,
    } as unknown as ReturnType<typeof getUnlinkStoreFromKiviUseCase>);
    vi.mocked(getRequestKiviSyncUseCase).mockReturnValue({
      execute: sync,
    } as unknown as ReturnType<typeof getRequestKiviSyncUseCase>);
  });

  describe('authorization', (): void => {
    it('uses the authenticated user and active tenant, ignoring client-supplied identities', async (): Promise<void> => {
      const data = pairForm({ tenantId: crypto.randomUUID(), userId: crypto.randomUUID() });
      const result = await pairKiviAction(initial, data);
      expect(result.success).toBe(true);
      expect(pair).toHaveBeenCalledWith({ userId: actor, tenantId: activeTenant, code: CODE });
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/integrations');
      expect(JSON.stringify(result)).not.toContain(CODE);
    });

    it('denies anonymous callers before touching any use case', async (): Promise<void> => {
      vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      } as unknown as Awaited<ReturnType<typeof createClient>>);
      for (const result of [
        await pairKiviAction(initial, pairForm()),
        await unlinkKiviAction(initial, new FormData()),
        await requestKiviSyncAction(initial, new FormData()),
      ]) {
        expect(result).toMatchObject({ success: false, errorCode: 'UNAUTHORIZED' });
      }
      expect(pair).not.toHaveBeenCalled();
      expect(unlink).not.toHaveBeenCalled();
      expect(sync).not.toHaveBeenCalled();
    });

    it('denies users without an active store', async (): Promise<void> => {
      vi.mocked(getActiveTenantQuery).mockResolvedValue(null);
      const result = await pairKiviAction(initial, pairForm());
      expect(result).toMatchObject({ success: false, errorCode: 'UNAUTHORIZED' });
      expect(pair).not.toHaveBeenCalled();
    });

    it('denies non-owners on every mutation', async (): Promise<void> => {
      pair.mockRejectedValue(new KiviLinkForbiddenException());
      unlink.mockRejectedValue(new KiviLinkForbiddenException());
      sync.mockRejectedValue(new KiviLinkForbiddenException());
      for (const result of [
        await pairKiviAction(initial, pairForm()),
        await unlinkKiviAction(initial, new FormData()),
        await requestKiviSyncAction(initial, new FormData()),
      ]) {
        expect(result).toMatchObject({ success: false, errorCode: 'FORBIDDEN' });
      }
    });

    it('never acts on another tenant: unlink and sync always target the session tenant', async (): Promise<void> => {
      const foreign = new FormData();
      foreign.set('tenantId', crypto.randomUUID());
      await unlinkKiviAction(initial, foreign);
      await requestKiviSyncAction(initial, foreign);
      expect(unlink).toHaveBeenCalledWith({ userId: actor, tenantId: activeTenant });
      expect(sync).toHaveBeenCalledWith({ userId: actor, tenantId: activeTenant });
    });
  });

  describe('validation', (): void => {
    it('rejects a pasted kc_ token with an inline error and never echoes it', async (): Promise<void> => {
      const token = 'kc_' + 'A'.repeat(43);
      const result = await pairKiviAction(initial, pairForm({ code: token }));
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_INPUT');
      expect(result.fieldErrors?.code).toEqual(['validation.codeIsToken']);
      expect(JSON.stringify(result)).not.toContain(token);
      expect(pair).not.toHaveBeenCalled();
    });

    it('rejects empty and wrongly shaped codes inline without calling Kivi', async (): Promise<void> => {
      const empty = await pairKiviAction(initial, pairForm({ code: '   ' }));
      expect(empty.fieldErrors?.code).toEqual(['validation.codeRequired']);
      const wrong = await pairKiviAction(initial, pairForm({ code: 'hello world' }));
      expect(wrong.fieldErrors?.code).toEqual(['validation.codeFormat']);
      expect(JSON.stringify(wrong)).not.toContain('hello world');
      expect(pair).not.toHaveBeenCalled();
    });

    it('maps a use-case format rejection to the code field', async (): Promise<void> => {
      pair.mockRejectedValue(new InvalidKiviPairingCodeException());
      const result = await pairKiviAction(initial, pairForm());
      expect(result).toMatchObject({ success: false, errorCode: 'INVALID_INPUT' });
      expect(result.fieldErrors?.code).toEqual(['validation.codeFormat']);
    });
  });

  describe('Kivi error mapping', (): void => {
    it.each([
      ['invalid_or_expired_code', 'INVALID_CODE', 'errors.invalidOrExpired'],
      ['rate_limited', 'RATE_LIMITED', 'errors.rateLimited'],
      ['unavailable', 'UNAVAILABLE', 'errors.unavailable'],
    ] as const)('maps %s to friendly copy (%s)', async (failure, errorCode, key): Promise<void> => {
      pair.mockRejectedValue(new KiviPairingException(failure));
      const result = await pairKiviAction(initial, pairForm());
      expect(result).toMatchObject({ success: false, errorCode, message: key });
      expect(JSON.stringify(result)).not.toContain(CODE);
    });

    it('shows the invalid-code message inline on the code field', async (): Promise<void> => {
      pair.mockRejectedValue(new KiviPairingException('invalid_or_expired_code'));
      const result = await pairKiviAction(initial, pairForm());
      expect(result.fieldErrors?.code).toEqual(['errors.invalidOrExpired']);
    });

    it('reports a platform that is not configured without leaking details', async (): Promise<void> => {
      pair.mockRejectedValue(
        new KiviConfigurationException('KIVI_TOKEN_ENCRYPTION_KEY is not configured'),
      );
      const result = await pairKiviAction(initial, pairForm());
      expect(result).toMatchObject({
        success: false,
        errorCode: 'NOT_CONFIGURED',
        message: 'errors.notConfigured',
      });
      expect(JSON.stringify(result)).not.toContain('KIVI_TOKEN_ENCRYPTION_KEY');
    });

    it('masks unexpected failures', async (): Promise<void> => {
      pair.mockRejectedValue(new Error('postgres://secret ' + CODE));
      const result = await pairKiviAction(initial, pairForm());
      expect(result).toMatchObject({ errorCode: 'UNEXPECTED', message: 'unexpected' });
      expect(JSON.stringify(result)).not.toContain('postgres://');
      expect(JSON.stringify(result)).not.toContain(CODE);
    });
  });

  describe('lifecycle', (): void => {
    it('reports a missing connection when unlinking or syncing', async (): Promise<void> => {
      unlink.mockRejectedValue(new KiviConnectionNotFoundException());
      sync.mockRejectedValue(new KiviConnectionNotFoundException());
      expect(await unlinkKiviAction(initial, new FormData())).toMatchObject({
        errorCode: 'NOT_LINKED',
      });
      expect(await requestKiviSyncAction(initial, new FormData())).toMatchObject({
        errorCode: 'NOT_LINKED',
      });
    });

    it('masks unexpected failures when syncing', async (): Promise<void> => {
      sync.mockRejectedValue(new Error('connection string postgres://secret'));
      const result = await requestKiviSyncAction(initial, new FormData());
      expect(result).toMatchObject({
        success: false,
        errorCode: 'UNEXPECTED',
        message: 'unexpected',
      });
      expect(JSON.stringify(result)).not.toContain('postgres://');
    });

    it('confirms sync and unlink success', async (): Promise<void> => {
      expect(await requestKiviSyncAction(initial, new FormData())).toMatchObject({
        success: true,
        message: 'syncRequested',
      });
      expect(await unlinkKiviAction(initial, new FormData())).toMatchObject({
        success: true,
        message: 'unlinked',
      });
    });
  });
});
