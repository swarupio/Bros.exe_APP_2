import assert from 'node:assert/strict';
import { startServer } from './server.js';
process.env.PORT='0';
const app=await startServer();
try {
  const address=app.server.address();
  if (!address || typeof address==='string') throw new Error('API did not bind to a port');
  const base=`http://127.0.0.1:${address.port}`;
  const health=await fetch(`${base}/api/v1/health`);
  assert.equal(health.status,200);
  const protectedRoute=await fetch(`${base}/api/v1/cases`);
  assert.equal(protectedRoute.status,process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY ? 401 : 503);
  const resources=await (await fetch(`${base}/api/v1/resources`)).json() as {resources:{status:string;phone?:string|null}[]};
  assert.ok(resources.resources.every(r => r.status==='verified' || r.phone===null));
  console.log('Real HTTP startup, health, auth rejection and safe resources smoke check passed');
} finally { await app.close(); }
