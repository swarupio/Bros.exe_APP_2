import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { retrievalResponseSchema,type RetrievalResponse } from '@kayda-sathi/shared';
import { packs,publicResources,emergency } from './knowledge.js';
import type { Snapshot } from './store.js';

const config=z.object({version:z.string(),topics:z.record(z.string(),z.array(z.string())),resource_topics:z.record(z.string(),z.array(z.string())),safety_resources:z.array(z.string())}).parse(JSON.parse(readFileSync(new URL('../../../packages/knowledge/retrieval.json',import.meta.url),'utf8')));
const normalize=(text:string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim();
const stop=new Set('a an the my me i is was are has have had of to for and or with it this that not no in on please help'.split(' '));
const tokens=(text:string) => normalize(text).split(/\s+/).filter(t => t && !stop.has(t));
const phrase=(text:string,term:string) => ` ${normalize(text)} `.includes(` ${normalize(term)} `);
type Coverage={state?:string;district?:string;city?:string};
export interface RetrievalDocument {
  id:string;kind:'claim'|'checklist'|'resource';pack_id:string|null;text:string;search:string;
  status:'seed'|'verified'|'draft';source_name:string;source_url:string|null;last_checked:string;
  coverage?:Coverage;scope?:'national'|'state'|'district'|'city';roles?:string[];pack_ids?:string[];phone?:string|null;
}
export function knowledgeDocuments():RetrievalDocument[] {
  return [
    ...packs.flatMap(p => [
      ...p.claims.map(c => ({id:c.id,kind:'claim' as const,pack_id:p.pack_id,text:c.text_en,search:`${p.match_hints.join(' ')} ${c.text_en}`,status:c.status,source_name:c.source.name,source_url:c.source.url ?? null,last_checked:c.last_checked,coverage:c.coverage,roles:c.roles})),
      ...p.checklist.map(c => ({id:`${p.pack_id}:${c.key}`,kind:'checklist' as const,pack_id:p.pack_id,text:`${c.label_en}. ${c.why_en}`,search:`${p.match_hints.join(' ')} ${c.label_en} ${c.why_en} ${c.alternatives_en.join(' ')}`,status:'seed' as const,source_name:'Curated preparation checklist; not a statement of law',source_url:null,last_checked:p.claims[0]?.last_checked ?? '1970-01-01'})),
    ]),
    ...publicResources().resources.map(r => ({id:r.id,kind:'resource' as const,pack_id:null,text:r.name,search:`${r.name} ${r.type}`,status:r.status,source_name:r.name,source_url:r.url,last_checked:r.last_checked,coverage:r.coverage,scope:r.scope,roles:r.roles,pack_ids:r.pack_ids ?? config.resource_topics[r.id],phone:r.phone})),
  ];
}
// BM25 ranks curated snippets without embeddings. Topic/coverage gates run before ranking.
function bm25(query:string,documents:RetrievalDocument[]) {
  const terms=[...new Set(tokens(query))].slice(0,128), bags=documents.map(d => tokens(d.search));
  const average=bags.reduce((n,b) => n+b.length,0)/Math.max(1,bags.length);
  return documents.map((d,i) => {
    let score=0;
    for (const term of terms) {
      const tf=bags[i].filter(t => t===term).length;
      if (!tf) continue;
      const df=bags.filter(b => b.includes(term)).length;
      const idf=Math.log(1+(bags.length-df+0.5)/(df+0.5));
      score+=idf*tf*2.2/(tf+1.2*(0.25+0.75*bags[i].length/Math.max(1,average)));
    }
    return {document:d,score};
  });
}
export function retrieveContext(snapshot:Snapshot,query?:string,options:{documents?:RetrievalDocument[];allowSeed?:boolean;now?:Date}={}):RetrievalResponse {
  const active=snapshot.facts.filter(f => !f.retired_at);
  const confirmed=active.filter(f => f.status==='confirmed' && !active.some(other => other.id!==f.id && other.key===f.key && (other.status==='disputed' || (other.status!=='unknown' && JSON.stringify(other.value)!==JSON.stringify(f.value)))));
  const value=(key:string) => {const found=confirmed.find(f => f.key===key);return found && typeof found.value==='string' ? found.value : null;};
  const location={state:value('state'),district:value('district'),city:value('city')};
  const role=value('user_role');
  // Party names and arbitrary place names do not establish topic or jurisdiction.
  const context=confirmed.filter(f => f.kind!=='party' && f.kind!=='place' && !['state','district','city'].includes(f.key)).map(f => `${f.key.replaceAll('_',' ')} ${typeof f.value==='string' ? f.value : ''}`).join(' ');
  const primary=query ?? context;
  const topics=packs.map(p => {
    // Generic words alone do not establish a legal problem category.
    const generic=new Set(['service','refund','deposit','flat']);
    const terms=[...new Set([...p.match_hints,...config.topics[p.pack_id] ?? []])].filter(t => !generic.has(normalize(t)));
    const direct=terms.filter(t => phrase(primary,t));
    const narrative=terms.filter(t => phrase(snapshot.case.original_account,t));
    const score=direct.reduce((n,t) => n+2+Math.min(2,tokens(t).length-1),0)+narrative.reduce((n,t) => n+1+Math.min(1,tokens(t).length-1),0);
    return {pack_id:p.pack_id,score,reasons:[...(direct.length ? ['Matched your question or confirmed problem facts.'] : []),...(narrative.length ? ['Matched your original account; this is a topic hint, not a confirmed fact.'] : [])]};
  }).filter(t => t.score>0).sort((a,b) => b.score-a.score || a.pack_id.localeCompare(b.pack_id));
  const ambiguous=topics.length>1 && topics[1].score>=topics[0].score*0.5;
  const selected=topics.filter(t => t.score>=topics[0].score*0.5).slice(0,3).map(t => t.pack_id);
  const urgent=snapshot.case.urgency!=='none' || emergency(snapshot.case.original_account).urgent || Boolean(query && emergency(query).urgent) || confirmed.some(f => ['threat_present','cannot_safely_contact'].includes(f.key) && f.value===true);
  const now=options.now ?? new Date(),allowSeed=options.allowSeed ?? process.env.ALLOW_SEED_CLAIMS!=='false';
  const warnings:string[]=[];
  const documents=(options.documents ?? knowledgeDocuments()).filter(d => {
    if (d.status==='draft' || (d.status==='seed' && !allowSeed)) return false;
    if (d.roles?.length && (!role || !d.roles.includes(role))) return false;
    if (d.coverage && Object.entries(d.coverage).some(([key,place]) => !location[key as keyof typeof location] || normalize(location[key as keyof typeof location]!)!==normalize(place!))) return false;
    if (d.kind==='resource' && d.scope!=='national' && (!d.coverage?.state || (d.scope==='district' && !d.coverage.district) || (d.scope==='city' && !d.coverage.city))) return false;
    const checked=Date.parse(d.last_checked);
    if (!Number.isFinite(checked) || checked>now.getTime() || now.getTime()-checked>365*86400000) {warnings.push('Some entries were excluded because their review date needs refreshing.');return false;}
    if (d.kind!=='resource') return Boolean(d.pack_id && selected.includes(d.pack_id));
    if (config.safety_resources.includes(d.id)) return urgent;
    // New directory entries must declare topic coverage (empty means general help).
    return d.pack_ids!==undefined && (!d.pack_ids.length || d.pack_ids.some(id => selected.includes(id)));
  });
  const ranked=bm25(`${query ?? ''} ${context} ${snapshot.case.original_account}`,documents).map(({document:d,score}) => {
    const topic=d.pack_id ? topics.find(t => t.pack_id===d.pack_id)?.score ?? 0 : 0;
    const coverage=d.kind==='resource' ? d.scope ?? 'national' : 'topic';
    const specificity={topic:0,national:0,state:1,district:2,city:3}[coverage];
    const reasons=[...(topic ? ['Matches a relevant problem topic.'] : []),...(coverage==='national' ? ['National coverage; proximity has not been established.'] : coverage!=='topic' ? [`Matches your confirmed ${coverage}.`] : []),...(d.roles?.length ? ['Matches your confirmed role.'] : []),...(d.status==='seed' ? ['Seed entry awaiting human verification.'] : ['Human verification metadata is present.'])];
    return {id:d.id,kind:d.kind,pack_id:d.pack_id,text:d.text,score:Math.round((score+topic+specificity+(urgent && config.safety_resources.includes(d.id) ? 100 : 0))*1000)/1000,status:d.status as 'seed'|'verified',source_name:d.source_name,source_url:d.source_url,last_checked:d.last_checked,reasons,coverage,phone:d.status==='verified' ? d.phone ?? null : null};
  }).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
  // Separate budgets prevent a long checklist from crowding out assistance resources.
  const hits=(['claim','checklist','resource'] as const).flatMap(kind => ranked.filter(h => h.kind===kind).slice(0,kind==='resource' ? 5 : 6));
  const questions=[];
  if (ambiguous) questions.push({key:'problem_focus',text:'Which problem should we work on first? More than one topic matched.'});
  if (!location.state) questions.push({key:'state',text:'Which state is this problem in? Confirm it to narrow jurisdiction and assistance.'});
  else if (!location.district && !location.city) questions.push({key:'district',text:'Which district or city should we use to look for local assistance?'});
  if (!value('desired_outcome')) questions.push({key:'desired_outcome',text:'What outcome would you like to work toward?'});
  if (!role) questions.push({key:'user_role',text:'Are you the affected person, the other side, or helping someone?'});
  if (!topics.length) warnings.push('No supported topic matched. Use general preparation and seek qualified advice.');
  if (!hits.some(h => h.kind==='resource' && h.coverage!=='national')) warnings.push('No matching local directory entry is available. National entries are not nearby results.');
  if (hits.some(h => h.status==='seed')) warnings.push('Seed content is unverified; it does not establish legal rights or eligibility.');
  return retrievalResponseSchema.parse({method:'lexical_bm25',corpus_version:`${config.version}:${packs.map(p => `${p.pack_id}@${p.pack_version}`).join(',')}:${publicResources().version}`,case_rev:snapshot.case.rev,topics,ambiguous,location,hits,questions:questions.slice(0,3),warnings:[...new Set(warnings)],urgent});
}
