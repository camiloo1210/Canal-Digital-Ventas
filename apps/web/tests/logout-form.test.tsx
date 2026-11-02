import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LogoutForm } from '@/features/iam/components/logout-form';

vi.mock('@/features/iam/actions/logout.action', (): object => ({ logoutAction: vi.fn() }));
vi.mock('@/features/cart/sync/cart-session', (): object => ({ endCartSession: vi.fn() }));

describe('LogoutForm', (): void => {
  it('renders a form that wraps the sign-out controls and keeps hidden inputs', (): void => {
    const html = renderToStaticMarkup(
      <LogoutForm className="w-full">
        <input type="hidden" name="redirectTo" value="/" />
        <button type="submit">Salir</button>
      </LogoutForm>,
    );
    expect(html).toContain('<form');
    expect(html).toContain('name="redirectTo"');
    expect(html).toContain('Salir');
  });
});
