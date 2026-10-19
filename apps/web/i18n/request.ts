import { getRequestConfig, type RequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import esMessages from '@/messages/es.json';
import enMessages from '@/messages/en.json';

export default getRequestConfig(async (): Promise<RequestConfig> => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'es';

  return {
    locale,
    messages: locale === 'en' ? enMessages : esMessages,
  };
});
