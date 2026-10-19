import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePathname } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import {
  NotFoundHomeLink,
  NotFoundRecovery,
} from '@/features/navigation/components/not-found-navigation';

vi.mock('next/navigation', (): object => ({ usePathname: vi.fn() }));

const labels = {
  home: 'Volver al inicio',
  dashboard: 'Volver al panel de administración',
  homeHint: 'Encuentra tiendas',
  dashboardHint: 'Gestiona tu tienda',
};

function markup(pathname: string): string {
  vi.mocked(usePathname).mockReturnValue(pathname);
  return renderToStaticMarkup(
    <>
      <NotFoundHomeLink>Canal Digital</NotFoundHomeLink>
      <NotFoundRecovery labels={labels} />
    </>,
  );
}

describe('404 navigation context', (): void => {
  it.each(['/dashboard', '/dashboard/missing', '/dashboard/catalog/products/missing/edit'])(
    'returns both recovery links from %s to the admin dashboard',
    (pathname: string): void => {
      const html = markup(pathname);
      expect(html.match(/href="\/dashboard"/g)).toHaveLength(2);
      expect(html).not.toContain('href="/"');
      expect(html).toContain(labels.dashboard);
      expect(html).toContain(labels.dashboardHint);
      expect(html).not.toContain(labels.homeHint);
    },
  );

  it.each(['/missing', '/store/missing', '/dashboard-other/missing'])(
    'keeps the buyer and storefront recovery from %s at home',
    (pathname: string): void => {
      const html = markup(pathname);
      expect(html.match(/href="\/"/g)).toHaveLength(2);
      expect(html).not.toContain('href="/dashboard"');
      expect(html).toContain(labels.home);
      expect(html).toContain(labels.homeHint);
      expect(html).not.toContain(labels.dashboardHint);
    },
  );
});
