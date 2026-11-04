import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/auth/callback/route';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  exchange: vi.fn(),
  getUser: vi.fn(),
  complete: vi.fn(),
}));

vi.mock('server-only', (): object => ({}));
vi.mock('next/headers', (): object => ({
  cookies: async (): Promise<object> => ({ get: mocks.cookieGet, delete: mocks.cookieDelete }),
}));
vi.mock('@/features/iam/di/iam.di', (): object => ({
  getExchangeOAuthCodeUseCase: async (): Promise<object> => ({ execute: mocks.exchange }),
}));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({
    auth: { getUser: mocks.getUser },
    schema: (): object => ({
      from: (): object => ({
        select: (): object => ({
          eq: (): object => ({
            eq: (): object => ({ limit: async (): Promise<object> => ({ data: [], error: null }) }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock('@/features/users/google-invitation', (): object => ({
  completeGoogleInvitation: mocks.complete,
}));

const token = 'y'.repeat(43);
const userId = crypto.randomUUID();
const cookieValue = JSON.stringify({ token, consent: false });
const request = (): Request => new Request('https://shop.test/auth/callback?code=abc');

function withCookies(entries: Record<string, string>): void {
  mocks.cookieGet.mockImplementation((name: string): { value: string } | undefined =>
    name in entries ? { value: entries[name] } : undefined,
  );
}

beforeEach((): void => {
  vi.clearAllMocks();
  withCookies({});
  mocks.exchange.mockResolvedValue(undefined);
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } });
  mocks.complete.mockResolvedValue({ ok: true });
});

describe('OAuth callback with a pending Google invitation', (): void => {
  it('accepts the invitation for the session user, clears the cookie and goes to the dashboard', async (): Promise<void> => {
    withCookies({ invite_google_pending: cookieValue });
    const response = await GET(request());
    expect(mocks.complete).toHaveBeenCalledWith({ token, consent: false }, userId);
    expect(mocks.cookieDelete).toHaveBeenCalledWith('invite_google_pending');
    expect(response.headers.get('location')).toBe('https://shop.test/dashboard');
  });

  it('sends the visitor back to the invitation with an error when acceptance fails', async (): Promise<void> => {
    withCookies({ invite_google_pending: cookieValue });
    mocks.complete.mockResolvedValue({ ok: false, error: 'invitationNotUsable' });
    const response = await GET(request());
    expect(response.headers.get('location')).toBe(
      `https://shop.test/invite/${token}?error=invitationNotUsable`,
    );
    expect(mocks.cookieDelete).toHaveBeenCalledWith('invite_google_pending');
  });

  it('reports a failed code exchange on the invitation page and does not accept', async (): Promise<void> => {
    withCookies({ invite_google_pending: cookieValue });
    mocks.exchange.mockRejectedValue(new Error('bad code'));
    const spy = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    const response = await GET(request());
    spy.mockRestore();
    expect(response.headers.get('location')).toBe(
      `https://shop.test/invite/${token}?error=googleFailed`,
    );
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).toHaveBeenCalledWith('invite_google_pending');
  });

  it('reports a missing session on the invitation page', async (): Promise<void> => {
    withCookies({ invite_google_pending: cookieValue });
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET(request());
    expect(response.headers.get('location')).toBe(
      `https://shop.test/invite/${token}?error=googleFailed`,
    );
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('ignores a tampered cookie and follows the normal sign-in flow', async (): Promise<void> => {
    withCookies({ invite_google_pending: JSON.stringify({ token: '../../x', consent: true }) });
    const response = await GET(request());
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).toHaveBeenCalledWith('invite_google_pending');
    expect(response.headers.get('location')).toBe('https://shop.test/');
  });

  it('does nothing invitation-related without the cookie', async (): Promise<void> => {
    const response = await GET(request());
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('https://shop.test/');
  });
});
