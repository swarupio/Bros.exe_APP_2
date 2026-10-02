import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { detectEmergency } from '../../../packages/knowledge/emergency.mjs';
const root = new URL('../../../packages/knowledge/',import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file,root),'utf8'));
export const coverageSchema=z.object({state:z.string().trim().min(1).optional(),district:z.string().trim().min(1).optional(),city:z.string().trim().min(1).optional()}).strict().refine(v => (!v.district && !v.city) || Boolean(v.state),'Local coverage requires a state');
const claimSchema=z.object({id:z.string().min(1),type:z.enum(['practice','legal','resource']),text_en:z.string().min(1),status:z.enum(['seed','verified','draft']),source:z.object({name:z.string().min(1),url:z.string().url().nullable().optional()}).passthrough(),last_checked:z.iso.date(),verified_by:z.string().nullable().optional(),verified_on:z.iso.date().nullable().optional(),coverage:coverageSchema.optional(),roles:z.array(z.enum(['affected_person','other_side','helper'])).optional()}).passthrough().refine(c => c.status!=='verified' || Boolean(c.verified_by?.trim() && c.verified_on && c.source.url),'Verified claims need human review metadata and a source URL');
const packSchema=z.object({pack_id:z.string(),pack_version:z.string(),match_hints:z.array(z.string()),claims:z.array(claimSchema),checklist:z.array(z.object({key:z.string(),label_en:z.string(),why_en:z.string(),alternatives_en:z.array(z.string())}))}).passthrough();
export const packs=['rent_deposit','consumer','cyber_fraud'].map(id => packSchema.parse(read(`packs/${id}.json`)));
const resourceSchema = z.object({ id: z.string(), name: z.string(), type: z.string(), scope: z.enum(['national','state','district','city']), coverage:coverageSchema.optional(),pack_ids:z.array(z.string()).optional(),roles:z.array(z.enum(['affected_person','other_side','helper'])).optional(), phone: z.string().nullable().optional(), url: z.string().url(), status: z.enum(['draft','seed','verified']), last_checked: z.iso.date(), verified_by: z.string().nullable().optional(), verified_on: z.iso.date().nullable().optional() }).refine(r => r.status!=='verified' || Boolean(r.verified_by?.trim() && r.verified_on),'Verified resources need human review metadata').refine(r => r.scope==='national' || Boolean(r.coverage?.state && (r.scope!=='district' || r.coverage.district) && (r.scope!=='city' || r.coverage.city)),'Local resources need explicit coverage');
export function publicResources() {
  const directory = read('resources.json');
  return { version: directory.version, resources: z.array(resourceSchema).parse(directory.resources).filter(r => r.status !== 'draft').map(r => ({ ...r, phone: r.status === 'verified' && r.verified_by && r.verified_on ? r.phone : null })) };
}
export function matchPack(text: string) {
  const normalized=text.normalize('NFKC').toLowerCase();
  return packs.find(p => p.match_hints.some(h => {
    const phrase=h.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
    return new RegExp(`(?:^|[^\\p{L}\\p{M}\\p{N}_])${phrase}(?=$|[^\\p{L}\\p{M}\\p{N}_])`,'u').test(normalized);
  }))?.pack_id ?? null;
}
export function emergency(text:string) {
  // Explicit fictional framing is not an account of the user's current danger.
  // Mixed or unframed narratives keep the conservative non-blocking matcher.
  if (/^(?:hypothetically[,:]|for (?:a|my) (?:story|novel)[,:]|this is (?:a )?fictional (?:story|scenario)[,:])/i.test(text.trim()) && !/\b(?:actually|in real life|right now)\b/i.test(text)) return {urgent:false,reasons:[]};
  return detectEmergency(text,read('emergency_terms.json').locales);
}
