import { useAuth, type AuthResult } from '@/auth';
import { clearUserCaches } from '@/data';

/** Signs out and removes the user's keys and profile from the phone's secure storage. */
export function useSignOut(): () => Promise<AuthResult> {
  const { session, signOut } = useAuth();
  return async () => {
    const userId = session?.user.id;
    const result = await signOut();
    if (result.ok && userId) await clearUserCaches(userId);
    return result;
  };
}
