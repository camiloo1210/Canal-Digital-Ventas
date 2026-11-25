import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegacyOrderRedirect } from '@/features/store-directory/components/legacy-order-redirect';

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('react', (): object => ({
  useEffect: (effect: () => void): void => effect(),
}));
vi.mock('next/navigation', (): object => ({
  useRouter: (): object => ({ replace: mocks.replace }),
}));

describe('legacy order redirect', (): void => {
  beforeEach((): void => {
    mocks.replace.mockReset();
    vi.unstubAllGlobals();
  });

  it('redirects an old home-page order link to purchases', (): void => {
    vi.stubGlobal('window', { location: { pathname: '/', hash: '#order-123' } });
    LegacyOrderRedirect();
    expect(mocks.replace).toHaveBeenCalledWith('/purchases#order-123');
  });

  it('does not redirect while navigating away from a purchase with an order fragment', (): void => {
    vi.stubGlobal('window', { location: { pathname: '/purchases', hash: '#order-123' } });
    LegacyOrderRedirect();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('leaves other home-page fragments alone', (): void => {
    vi.stubGlobal('window', { location: { pathname: '/', hash: '#buyer-main' } });
    LegacyOrderRedirect();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
