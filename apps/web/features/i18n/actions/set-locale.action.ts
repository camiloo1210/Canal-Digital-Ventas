'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function setLocaleAction(formData: FormData): Promise<{ error: string } | undefined> {
  const locale = formData.get('locale') as string;

  if (locale !== 'en' && locale !== 'es') {
    return { error: 'Invalid locale' };
  }

  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 31536000, // 1 year
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
}
