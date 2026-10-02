import 'dotenv/config';
import { readFile,writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { intakeInferenceSchema,validFactValue } from '@kayda-sathi/shared';
import { AnthropicInference,inferOrFallback } from '../src/ai.js';
import { emergency,matchPack,packs } from '../src/knowledge.js';
import { legalLint } from '../src/draft-tools.js';

const caseSchema=z.object({id:z.string(),group:z.enum(['rent','consumer','cyber','wages','safety','general','adversarial']),language:z.enum(['en','hi','mr']),text:z.string().min(20).max(3000),pack:z.string().nullable(),urgent:z.boolean()});
const cases=z.array(caseSchema).length(40).parse(JSON.parse(await readFile(new URL('../../../tools/eval/cases.json',import.meta.url),'utf8')));
const live=process.argv.includes('--live');
if (live && !process.env.ANTHROPIC_API_KEY) throw new Error('Live evaluation needs ANTHROPIC_API_KEY in apps/api/.env');
const ai=live ? new AnthropicInference(process.env.ANTHROPIC_API_KEY!,process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001') : undefined;
const results:{id:string;group:string;pack_ok:boolean;urgency_ok:boolean;fallback:boolean;provenance_ok:boolean;lint_ok:boolean;latency_ms:number}[]=[];
for (const item of cases) {
  const case_id='00000000-0000-4000-8000-000000000001',started=performance.now(),safety=emergency(item.text);
  const fallback=() => intakeInferenceSchema.parse({case_id,title:'Evaluation case',issue_tags:[],pack_id:matchPack(item.text),urgency:safety.urgent ? 'urgent' : 'none',safety_reasons:safety.reasons,user_role:'unknown',facts:[],questions:[],restatement:'Review the account and confirm the facts.'});
  const result=await inferOrFallback(ai,intakeInferenceSchema,{case_id,account:item.text,language:item.language,allowed_pack_ids:packs.map(p => p.pack_id)},fallback,v => {
    if (v.case_id!==case_id || (v.pack_id && !packs.some(p => p.pack_id===v.pack_id))) throw new Error('INVALID_PACK');
    if (v.facts.some(f => !f.raw_text || !item.text.includes(f.raw_text) || !validFactValue({...f,status:'proposed'}))) throw new Error('INVALID_PROVENANCE');
    return v;
  });
  const value=result.value;
  results.push({id:item.id,group:item.group,pack_ok:value.pack_id===item.pack,urgency_ok:(safety.urgent || value.urgency==='urgent')===item.urgent,fallback:result.fallback,provenance_ok:value.facts.every(f => Boolean(f.raw_text && item.text.includes(f.raw_text))),lint_ok:legalLint([value.title,value.restatement,...value.questions.map(q => q.text)].join('\n')).length===0,latency_ms:Math.round(performance.now()-started)});
  console.log(`${item.id}: ${results.at(-1)!.pack_ok && results.at(-1)!.urgency_ok && results.at(-1)!.lint_ok ? 'pass' : 'review'}${result.fallback ? ' (fallback)' : ''}`);
}
const pass=results.filter(r => r.pack_ok && r.urgency_ok && r.provenance_ok && r.lint_ok).length;
const timings=results.map(r => r.latency_ms).sort((a,b) => a-b),p95=timings[Math.ceil(timings.length*.95)-1];
const lines=['# S-006 evaluation report','',`Mode: **${live ? 'live Anthropic structured inference' : 'offline deterministic fallback regression'}**.`,live ? 'Synthetic fixtures only; no user cases or narratives are included in the report.' : '**This is not a live-model accuracy or latency measurement.** All results use deterministic fallback classification/safety.', '',`Cases: ${cases.length}; all-check passes: ${pass}; fallback count: ${results.filter(r => r.fallback).length}; observed p95: ${p95} ms.`, '', '| Case | Pack | Urgency | Provenance | Lint | Fallback | ms |','|---|---|---|---|---|---|---|',...results.map(r => `| ${r.id} | ${r.pack_ok ? 'pass' : 'review'} | ${r.urgency_ok ? 'pass' : 'review'} | ${r.provenance_ok ? 'pass' : 'review'} | ${r.lint_ok ? 'pass' : 'review'} | ${r.fallback} | ${r.latency_ms} |`),'','Live provider failures/fallbacks must not count as successful model samples. Hosted Prisma/Supabase isolation, real-phone and second-device gates remain separate.',''];
await writeFile(new URL(`../../../tools/eval/report${live ? '-live' : ''}.md`,import.meta.url),lines.join('\n'));
if (pass!==cases.length || (live && results.some(r => r.fallback))) process.exitCode=1;
