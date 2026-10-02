import Fastify from "fastify";
import { healthResponseSchema } from "@kayda-sathi/shared";
import { registerAuth, type AuthVerifier } from "./auth.js";

export function createApp(options: { verifyToken?: AuthVerifier; mockAI?: boolean } = {}) {
  const app = Fastify({ logger: { redact: ["req.headers.authorization", "req.body"] } });
  registerAuth(app, options.verifyToken);
  app.get("/api/v1/health", async (_request, reply) => reply.send(healthResponseSchema.parse({
    status: "ok", kb_version: "1.0.0", mock_ai: options.mockAI ?? process.env.MOCK_AI === "true",
  })));
  return app;
}

const app = createApp();
const port = Number(process.env.PORT ?? 8080);
if (import.meta.url === `file://${process.argv[1]}`) await app.listen({ host: "0.0.0.0", port });
