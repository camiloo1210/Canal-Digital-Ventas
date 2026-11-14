import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import InviteCompletePage from '@/app/invite/complete/page';

const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), redirect: vi.fn() }));

vi.mock('@/features/users/queries/current-user.query', (): object => ({
  getCurrentUserQuery: mocks.currentUser,
}));
vi.mock('next/navigation', (): object => ({
  redirect: (path: string): never => {
    mocks.redirect(path);
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('@/features/users/components/invite-forms', (): object => ({
  GeneratedEmailNotice: ({ email }: { email: string }): React.JSX.Element => <p>{email}</p>,
}));

describe('invitation completion', (): void => {
  it('shows the authenticated account email without reading the consumed invitation', async (): Promise<void> => {
    mocks.currentUser.mockResolvedValue({ id: 'user', email: 'staff@shop.staff.invalid' });
    const html = renderToStaticMarkup(await InviteCompletePage());
    expect(html).toContain('staff@shop.staff.invalid');
  });

  it('redirects unauthenticated visitors to login', async (): Promise<void> => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(InviteCompletePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith('/login');
  });
});
