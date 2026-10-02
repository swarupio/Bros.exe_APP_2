import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import Fastify from "fastify";
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { prismaDatabase, type Database } from './database.js';
import { AnthropicInference, type Inference } from './ai.js';
import { APIError } from './errors.js';
import { registerRoutes } from './routes.js';
import { publicResources } from './knowledge.js';
import { cleanupEvidence } from './storage.js';
import { healthResponseSchema } from "@kayda-sathi/shared";
import { registerAuth, type AuthVerifier } from "./auth.js";

export function createApp(options: { verifyToken?: AuthVerifier; mockAI?: boolean; db?: Database; ai?: Inference; cleanup?: (user:string,caseId:string) => Promise<void> } = {}) {
  const app = Fastify({ logger:false, bodyLimit:131072 });
  app.register(cors,{origin:(process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost').split(',')});
  app.register(rateLimit,{max:30,timeWindow:'1 minute'});
  app.setErrorHandler((error,_request,reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({error:{code:'INVALID_INPUT',message:'Check the request fields',retryable:false}});
    if (error instanceof APIError) return reply.code(error.status).send({error:{code:error.code,message:error.code,retryable:error.retryable}});
    if (typeof error==='object' && error && 'statusCode' in error) {
      if (error.statusCode===429) return reply.code(429).send({error:{code:'RATE_LIMITED',message:'Try again shortly',retryable:true}});
      if ([400,413,415].includes(Number(error.statusCode))) return reply.code(Number(error.statusCode)).send({error:{code:error.statusCode===413 ? 'REQUEST_TOO_LARGE' : 'INVALID_INPUT',message:'Check the request content and size',retryable:false}});
    }
    return reply.code(503).send({error:{code:'SERVICE_UNAVAILABLE',message:'Service temporarily unavailable',retryable:true}});
  });
  registerAuth(app, options.verifyToken);
  app.setNotFoundHandler((_request,reply) => reply.code(404).send({error:{code:'NOT_FOUND',message:'Route not found',retryable:false}}));
  app.get("/api/v1/health", async (_request, reply) => reply.send(healthResponseSchema.parse({
    status: "ok", kb_version: publicResources().version, mock_ai: options.mockAI ?? process.env.MOCK_AI === "true",
  })));
  app.get('/api/v1/resources',async () => publicResources());
  registerRoutes(app,options);
  return app;
}

export async function startServer() {
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
  const authClient=url && key ? createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}) : undefined;
  const adminKey=process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin=url && adminKey ? createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}}) : undefined;
  const database=process.env.DATABASE_URL ? prismaDatabase(process.env.DATABASE_URL) : undefined;
  const mockAI=process.env.MOCK_AI==='true';
  const ai=!mockAI && process.env.ANTHROPIC_API_KEY ? new AnthropicInference(process.env.ANTHROPIC_API_KEY,process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001') : undefined;
  const app=createApp({db:database?.db,ai,mockAI,
    verifyToken:authClient ? async token => {
      const {data,error}=await authClient.auth.getUser(token);
      if (error && ((error.status ?? 0)>=500 || error.name==='AuthRetryableFetchError')) throw new Error('AUTH_UNAVAILABLE');
      return error ? null : data.user?.id ?? null;
    } : undefined,
    cleanup:admin ? (user,id) => cleanupEvidence(admin.storage.from('case-evidence'),user,id) : undefined,
  });
  app.addHook('onClose',async () => { await database?.close(); });
  await app.listen({host:'0.0.0.0',port:Number(process.env.PORT ?? 8080)});
  return app;
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await startServer();
