import { supabase } from './supabase';

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
}

export async function signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sign up failed'
    };
  }
}

export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sign in failed'
    };
  }
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Sign out failed:', error);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Get user failed:', error);
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await signOut();
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

// Legacy compatibility - these can be removed after migration
export function getPasscode(): string | null {
  return null;
}

export function getAuth(): AuthState | null {
  return null;
}
