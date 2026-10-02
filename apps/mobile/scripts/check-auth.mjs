import assert from "node:assert/strict";
import { createHash } from "node:crypto";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
const storage = new Map();
let redirect;
globalThis.window = Object.assign(new EventTarget(), {
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  location: { origin: "https://app.example.test", assign: value => { redirect = value; } },
});
const auth = await import("../components/supabase-auth.ts");
const sessionKey = "kayda-sathi-auth-session";
const verifierKey = "kayda-sathi-oauth-verifier";
const response = { access_token: "access", refresh_token: "refresh", expires_in: 3600, user: { id: "11111111-1111-4111-8111-111111111111", email: "a@example.test" } };
let calls = [];
let reply = response;
let status = 200;
globalThis.fetch = async (url, options) => {
  calls.push({ url, ...options });
  return new Response(status === 204 ? null : JSON.stringify(reply), { status });
};

await auth.signInWithPassword(" a@example.test ", "password");
assert.equal(calls.at(-1).url, "https://auth.example.test/auth/v1/token?grant_type=password");
assert.deepEqual(JSON.parse(calls.at(-1).body), { email: "a@example.test", password: "password" });
assert.equal(calls.at(-1).headers.apikey, "public-test-key");
assert.equal(await auth.getAccessToken(), "access");
assert.equal(calls.length, 1, "unexpired token needs no network request");

reply = { access_token: true, refresh_token: "refresh", expires_in: 3600, user: response.user };
await assert.rejects(auth.signInWithPassword("a@example.test", "password"), /invalid session/);
assert.equal(auth.currentUser().email, "a@example.test", "malformed login cannot overwrite a valid session");

reply = { user: response.user };
assert.equal(await auth.signUpWithPassword("a@example.test", "password"), null);
assert.equal(new URL(calls.at(-1).url).searchParams.get("redirect_to"), "https://app.example.test/auth/callback/");
assert.equal(JSON.parse(calls.at(-1).body).code_challenge, createHash("sha256").update(storage.get(verifierKey)).digest("base64url"));

await auth.startGoogleSignIn();
const authorize = new URL(redirect);
assert.equal(authorize.searchParams.get("provider"), "google");
assert.equal(authorize.searchParams.get("code_challenge"), createHash("sha256").update(storage.get(verifierKey)).digest("base64url"));
const verifier = storage.get(verifierKey);
reply = response;
await auth.finishGoogleSignIn("one-time-code");
assert.deepEqual(JSON.parse(calls.at(-1).body), { auth_code: "one-time-code", code_verifier: verifier });
assert.equal(storage.has(verifierKey), false);
await assert.rejects(auth.finishGoogleSignIn("reused-code"), /expired/);

function expire() {
  const stored = JSON.parse(storage.get(sessionKey));
  stored.expires_at = 1;
  storage.set(sessionKey, JSON.stringify(stored));
}
expire();
let count = calls.length;
await Promise.all([auth.getAccessToken(), auth.getAccessToken()]);
assert.equal(calls.length, count + 1, "concurrent requests share one refresh");
assert.equal(calls.at(-1).url, "https://auth.example.test/auth/v1/token?grant_type=refresh_token");

expire();
status = 503;
reply = { message: "Unavailable" };
await assert.rejects(auth.getAccessToken(), /Unavailable/);
assert.ok(storage.has(sessionKey), "temporary outage preserves the session for recovery");
status = 401;
reply = { error_description: "Invalid refresh token" };
assert.equal(await auth.getAccessToken(), null);
assert.equal(auth.currentUser(), null, "invalid refresh clears the session");

status = 200;
reply = response;
await auth.signInWithPassword("a@example.test", "password");
expire();
let finishRefresh;
globalThis.fetch = async url => url.includes("grant_type=refresh_token")
  ? new Promise(resolve => { finishRefresh = resolve; }) : new Response(null, { status: 204 });
const refreshing = auth.getAccessToken();
await auth.signOut();
finishRefresh(new Response(JSON.stringify(response), { status: 200 }));
assert.equal(await refreshing, null, "an in-flight refresh cannot undo sign-out");
assert.equal(auth.currentUser(), null);

globalThis.fetch = async () => new Response(JSON.stringify(response), { status: 200 });
await auth.signInWithPassword("a@example.test", "password");
globalThis.fetch = async () => { throw new Error("offline"); };
await assert.rejects(auth.signOut(), /offline/);
assert.equal(auth.currentUser(), null, "offline sign-out still removes local access");
// A refresh belonging to A must not sign B out when A's token is rejected.
globalThis.fetch = async () => new Response(JSON.stringify(response), { status: 200 });
await auth.signInWithPassword('a@example.test','password');expire();
let rejectOldRefresh;
const second={...response,access_token:'b-access',refresh_token:'b-refresh',user:{id:'22222222-2222-4222-8222-222222222222'}};
globalThis.fetch=async url => url.includes('grant_type=refresh_token') ? new Promise(resolve => {rejectOldRefresh=resolve;}) : new Response(JSON.stringify(second),{status:200});
const oldRefresh=auth.getAccessToken();
await auth.signInWithPassword('b@example.test','password');
rejectOldRefresh(new Response(JSON.stringify({message:'Invalid refresh'}),{status:401}));
await assert.rejects(oldRefresh,/Invalid refresh/);
assert.equal(auth.currentUser().id,second.user.id);
// Local logout finishes immediately; a subsequent account survives server latency.
let finishLogout;
globalThis.fetch=async url => url.includes('logout') ? new Promise(resolve => {finishLogout=resolve;}) : new Response(JSON.stringify(response),{status:200});
const logout=auth.signOut();assert.equal(auth.currentUser(),null);
await auth.signInWithPassword('a@example.test','password');
finishLogout(new Response(null,{status:204}));await logout;
assert.equal(auth.currentUser().id,response.user.id);
console.log("Auth request, PKCE, refresh, sign-out and account-switch race checks passed.");
