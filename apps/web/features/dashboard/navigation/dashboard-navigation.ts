export interface DashboardNavigationItem {
  key:
    | 'overview'
    | 'businessIntelligence'
    | 'orders'
    | 'products'
    | 'categories'
    | 'store'
    | 'integrations'
    | 'users'
    | 'profile';
  href: string;
  /** Any one of these permissions unlocks the destination; empty means every active member. */
  permissions: readonly string[];
  /** Reserved for the store owner regardless of any custom role. */
  ownerOnly?: boolean;
}

export const dashboardNavigation: readonly DashboardNavigationItem[] = [
  { key: 'overview', href: '/dashboard', permissions: [] },
  {
    key: 'businessIntelligence',
    href: '/dashboard/business-intelligence',
    permissions: ['VIEW_REPORTS'],
  },
  { key: 'orders', href: '/dashboard/orders', permissions: ['VIEW_ORDERS', 'MANAGE_ORDERS'] },
  {
    key: 'products',
    href: '/dashboard/catalog/products',
    permissions: ['VIEW_CATALOG', 'MANAGE_CATALOG'],
  },
  {
    key: 'categories',
    href: '/dashboard/catalog/categories',
    permissions: ['VIEW_CATALOG', 'MANAGE_CATALOG'],
  },
  { key: 'store', href: '/dashboard/store', permissions: ['MANAGE_STORE'] },
  { key: 'integrations', href: '/dashboard/integrations', permissions: [], ownerOnly: true },
  { key: 'users', href: '/dashboard/users', permissions: [], ownerOnly: true },
  /** Personal area of every member, whatever their role. */
  { key: 'profile', href: '/dashboard/profile', permissions: [] },
];

/** Keys of the destinations a member may see; mirrors the page guards. */
export function visibleDashboardNavigationKeys(
  baseRole: string,
  permissions: readonly string[],
): DashboardNavigationItem['key'][] {
  const owner = baseRole === 'OWNER';
  return dashboardNavigation
    .filter((item): boolean => {
      if (item.ownerOnly) return owner;
      if (owner || item.permissions.length === 0) return true;
      return item.permissions.some((permission): boolean => permissions.includes(permission));
    })
    .map((item): DashboardNavigationItem['key'] => item.key);
}

export function isDashboardDestinationActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
}
