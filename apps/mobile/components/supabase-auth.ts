"use client";

const sessionKey = "kayda-sathi-auth-session";
const verifierKey = "kayda-sathi-oauth-verifier";

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};

type AuthResponse = Omit<AuthSession, "expires_at"> & { expires_in: number };

class AuthRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Sign-in is not configured for this app.");
  return { url: url.replace(/\/$/, ""), key };
}

function storeSession(value: AuthResponse | AuthSession) {
  const expiresAt = "expires_at" in value ? value.expires_at : Math.floor(Date.now() / 1000) + value.expires_in;
  if (typeof value.access_token !== "string" || !value.access_token || typeof value.refresh_token !== "string" || !value.refresh_token
    || typeof value.user?.id !== "string" || !value.user.id || !Number.isFinite(expiresAt)) {
    throw new Error("The account service returned an invalid session. Please try again.");
  }
  const session: AuthSession = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: expiresAt, user: value.user };
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
  window.dispatchEvent(new Event("kayda-auth-changed"));
  return session;
}

function readSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(sessionKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<AuthSession>;
    return typeof session.access_token === "string" && typeof session.refresh_token === "string"
      && typeof session.expires_at === "number" && typeof session.user?.id === "string"
      ? session as AuthSession : null;
  } catch { return null; }
}

async function authRequest<T>(path: string, body?: unknown, accessToken?: string): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { apikey: key, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(12_000),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const message = [details.message, details.msg, details.error_description, details.error].find(value => typeof value === "string");
    throw new AuthRequestError(typeof message === "string" ? message : "Could not connect to the account service.", response.status);
  }
  if (!data || typeof data !== "object") {
    if (response.status === 204) return {} as T;
    throw new Error("The account service returned an invalid response. Please try again.");
  }
  return data as T;
}

export async function signInWithPassword(email: string, password: string) {
  const result = await authRequest<AuthResponse>("token?grant_type=password", { email: email.trim(), password });
  return storeSession(result);
}

export async function signUpWithPassword(email: string, password: string) {
  const challenge = await createCodeChallenge();
  const result = await authRequest<AuthResponse | { user?: AuthResponse["user"] }>(`signup?redirect_to=${encodeURIComponent(callbackUrl())}`, { email: email.trim(), password, code_challenge: challenge, code_challenge_method: "s256" });
  if ("access_token" in result) return storeSession(result);
  return null;
}

function callbackUrl() { return new URL("/auth/callback/", window.location.origin).toString(); }

async function createCodeChallenge() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  window.localStorage.setItem(verifierKey, verifier);
  return challenge;
}

export async function startGoogleSignIn() {
  const { url, key } = config();
  const challenge = await createCodeChallenge();
  const authorization = new URL(`${url}/auth/v1/authorize`);
  authorization.searchParams.set("provider", "google");
  authorization.searchParams.set("redirect_to", callbackUrl());
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "s256");
  authorization.searchParams.set("apikey", key);
  window.location.assign(authorization.toString());
}

export async function finishGoogleSignIn(code: string) {
  const verifier = window.localStorage.getItem(verifierKey);
  if (!verifier) throw new Error("This sign-in link expired. Please try Google sign-in again.");
  const session = storeSession(await authRequest<AuthResponse>("token?grant_type=pkce", { auth_code: code, code_verifier: verifier }));
  window.localStorage.removeItem(verifierKey);
  return session;
}

let refreshRequest: Promise<string | null> | null = null;
export async function getAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expires_at > Math.floor(Date.now() / 1000) + 30) return session.access_token;
  if (!refreshRequest) {
    refreshRequest = authRequest<AuthResponse>("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
      .then(value => readSession()?.refresh_token === session.refresh_token ? storeSession(value).access_token : readSession()?.access_token ?? null)
      .catch(error => {
        if (error instanceof AuthRequestError && (error.status === 400 || error.status === 401)) {
          window.localStorage.removeItem(sessionKey);
          window.dispatchEvent(new Event("kayda-auth-changed"));
          return null;
        }
        // Preserve the refresh token on network/server failure so reconnecting can recover.
        throw error;
      })
      .finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

export async function signOut() {
  const token = readSession()?.access_token;
  // Local sign-out remains available offline; server revocation needs connectivity.
  try { if (token) await authRequest("logout?scope=local", {}, token); }
  finally { window.localStorage.removeItem(sessionKey); window.localStorage.removeItem(verifierKey); window.dispatchEvent(new Event("kayda-auth-changed")); }
}

export function currentUser() { return readSession()?.user ?? null; }
