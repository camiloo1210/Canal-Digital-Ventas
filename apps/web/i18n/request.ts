import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Provide a static locale, fetch it from the user, or read from a cookie
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'es';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
