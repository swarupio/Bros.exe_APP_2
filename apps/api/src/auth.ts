import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { uuidSchema } from '@kayda-sathi/shared';

export type AuthVerifier = (token: string) => Promise<string | null>;

export function createSupabaseTokenVerifier(url: string, publishableKey: string, request: typeof fetch = fetch): AuthVerifier {
  const baseUrl = url.replace(/\/$/, "");
  return async token => {
    try {
      const response = await request(`${baseUrl}/auth/v1/user`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status>=500 || response.status===429) throw new Error('AUTH_UNAVAILABLE');
      if (!response.ok) return null;
      const user = await response.json() as { id?: unknown };
      return uuidSchema.safeParse(user.id).success ? user.id as string : null;
    } catch {
      throw new Error('AUTH_UNAVAILABLE');
    }
  };
}

declare module "fastify" {
  interface FastifyRequest { userId: string | null }
  interface FastifyInstance { requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> }
}

export function registerAuth(app: FastifyInstance, verifyToken: AuthVerifier | undefined = process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY
  ? createSupabaseTokenVerifier(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY)
  : undefined): void {
  app.decorateRequest("userId", null);
  app.decorate("requireAuth", async (request, reply) => {
    if (!verifyToken) return reply.code(503).send({ error: { code: "AUTH_NOT_CONFIGURED", message: "Authentication is not configured", retryable: false } });
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? "");
    let userId: string | null = null;
    try { userId = match ? await verifyToken(match[1]) : null; }
    catch { return reply.code(503).send({ error: { code: 'AUTH_UNAVAILABLE', message: 'Authentication is temporarily unavailable', retryable: true } }); }
    if (!userId) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue", retryable: false } });
    request.userId = userId;
  });
}
