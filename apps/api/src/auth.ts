import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export type AuthVerifier = (token: string) => Promise<string | null>;

declare module "fastify" {
  interface FastifyRequest { userId: string | null }
  interface FastifyInstance { requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> }
}

export function registerAuth(app: FastifyInstance, verifyToken?: AuthVerifier): void {
  app.decorateRequest("userId", null);
  app.decorate("requireAuth", async (request, reply) => {
    if (!verifyToken) return reply.code(503).send({ error: { code: "AUTH_NOT_CONFIGURED", message: "Authentication is not configured", retryable: false } });
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? "");
    const userId = match ? await verifyToken(match[1]) : null;
    if (!userId) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue", retryable: false } });
    request.userId = userId;
  });
}
