export const dashboardNavigation = [
  { key: 'overview', href: '/dashboard' },
  { key: 'businessIntelligence', href: '/dashboard/business-intelligence' },
  { key: 'orders', href: '/dashboard/orders' },
  { key: 'products', href: '/dashboard/catalog/products' },
  { key: 'categories', href: '/dashboard/catalog/categories' },
  { key: 'store', href: '/dashboard/store' },
  { key: 'integrations', href: '/dashboard/integrations' },
] as const;

export function isDashboardDestinationActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
}
