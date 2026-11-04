import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface CurrentUser {
  id: string;
  email: string;
  /** Sign-in provider of the current session (for example 'google' or 'email'). */
  provider: string;
}

/** The authenticated user, or null for visitors. */
export async function getCurrentUserQuery(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user
    ? {
        id: user.id,
        email: user.email ?? '',
        provider: String(user.app_metadata?.provider ?? ''),
      }
    : null;
}
