export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  passcode: string | null;
}

const AUTH_STORAGE_KEY = 'healthhub_auth';

export function saveAuth(userId: string, passcode: string): void {
  const authData: AuthState = {
    isAuthenticated: true,
    userId,
    passcode
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
}

export function getAuth(): AuthState | null {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  const auth = getAuth();
  return auth?.isAuthenticated === true;
}

export function getUserId(): string | null {
  return getAuth()?.userId || null;
}

export function getPasscode(): string | null {
  return getAuth()?.passcode || null;
}
