import { createClient } from '@supabase/supabase-js';
let client: ReturnType<typeof createClient> | undefined;
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return client ??= createClient(url, key);
}
export async function apiRequest<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const { data: { session } } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Sign in to continue');
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/v1${path}`, {
    method, headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.code ?? 'REQUEST_FAILED');
  return result as T;
}
