import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthAdapter } from '@/iam/infrastructure/adapters/supabase-auth.adapter';
import { InvalidCredentialsException } from '@/iam/domain/exceptions/invalid-credentials.exception';

describe('Supabase email identity authentication', (): void => {
  it('authenticates a buyer without tenant metadata', async (): Promise<void> => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        user: { id: 'buyer', app_metadata: {} },
        session: { access_token: 'test-session' },
      },
      error: null,
    });
    const adapter = new SupabaseAuthAdapter({
      auth: { signInWithPassword },
    } as unknown as SupabaseClient);
    await expect(adapter.signInWithEmail('buyer@example.test', 'password')).resolves.toEqual({
      userId: 'buyer',
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'buyer@example.test',
      password: 'password',
    });
  });
  it('does not grant tenant authority from authentication metadata', async (): Promise<void> => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        user: { id: 'seller', app_metadata: { app_tenant_id: 'untrusted-tenant' } },
        session: {},
      },
      error: null,
    });
    const adapter = new SupabaseAuthAdapter({
      auth: { signInWithPassword },
    } as unknown as SupabaseClient);
    await expect(adapter.signInWithEmail('seller@example.test', 'password')).resolves.toEqual({
      userId: 'seller',
    });
  });
  it('still rejects invalid credentials', async (): Promise<void> => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 400, message: 'Invalid login credentials' },
    });
    const adapter = new SupabaseAuthAdapter({
      auth: { signInWithPassword },
    } as unknown as SupabaseClient);
    await expect(adapter.signInWithEmail('buyer@example.test', 'wrong')).rejects.toBeInstanceOf(
      InvalidCredentialsException,
    );
  });
});
