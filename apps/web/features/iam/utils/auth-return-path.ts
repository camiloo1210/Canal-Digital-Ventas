/** Only buyer destinations may be supplied by an authentication request. */
export function safeAuthReturnPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://return.invalid');
    if (!value.startsWith('/') || value.startsWith('//') || url.origin !== 'https://return.invalid')
      return fallback;
    if (
      url.pathname !== '/' &&
      url.pathname !== '/purchases' &&
      url.pathname !== '/purchases/' &&
      !/^\/store\/[a-z0-9][a-z0-9-]*(?:\/checkout|\/products\/[a-zA-Z0-9-]+)?\/?$/.test(
        url.pathname,
      )
    )
      return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buyerAuthHref(route: '/login' | '/signup', returnPath: unknown): string {
  return `${route}?${new URLSearchParams({ redirectTo: safeAuthReturnPath(returnPath) })}`;
}
