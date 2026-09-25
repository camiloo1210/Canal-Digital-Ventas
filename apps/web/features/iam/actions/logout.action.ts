'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function logoutAction(formData?: FormData): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  const redirectTo = formData?.get('redirectTo')?.toString() || '/login';
  
  // Basic security to avoid open redirect vulnerabilities
  // Must start with exactly one slash, not two (which means absolute URL protocol-relative)
  const isInternal = redirectTo.startsWith('/') && !redirectTo.startsWith('//');
  const safeRedirect = isInternal ? redirectTo : '/login';
  
  redirect(safeRedirect);
}
