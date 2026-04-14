export type AuthProviderHint = "google" | "email";

const AUTH_PROVIDER_HINT_KEY = "buyer-codex.last-auth-provider";

export function rememberAuthProviderHint(provider: AuthProviderHint) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_PROVIDER_HINT_KEY, provider);
}

export function readAuthProviderHint(): AuthProviderHint | undefined {
  if (typeof window === "undefined") return undefined;
  const value = window.localStorage.getItem(AUTH_PROVIDER_HINT_KEY);
  return value === "google" || value === "email" ? value : undefined;
}

export function clearAuthProviderHint() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_PROVIDER_HINT_KEY);
}
