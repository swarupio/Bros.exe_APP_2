import 'dotenv/config';
const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','DATABASE_URL'];
if (process.env.MOCK_AI !== 'true') required.push('ANTHROPIC_API_KEY');
const missing=required.filter(key => !process.env[key]);
if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SECRET_KEY (storage cleanup)');
for (const key of missing) console.error(`Missing: ${key}`);
if (missing.length) process.exitCode=1;
else console.log('Server environment has required values (live connectivity/provider evaluation still required)');
