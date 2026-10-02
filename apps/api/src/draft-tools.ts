import { readinessResponseSchema, type Fact } from '@kayda-sathi/shared';
import { derivedAmounts, hashFacts, type FactRow, type Snapshot } from './store.js';

export function legalLint(text:string):string[] {
  const violations:string[]=[];
  if (/\b(?:section|article)\s+\d|\b(?:IPC|BNS|CrPC|statutory|legally required|legal deadline|law requires|legally entitled|must file|you are entitled|you have a right to)\b|\b\w+\s+Act,?\s+(?:19|20)\d{2}\b/i.test(text)) violations.push('UNSOURCED_LEGAL_ASSERTION');
  if (/\b(?:guaranteed|definitely win|you will win|must sue|certain to win)\b/i.test(text)) violations.push('OUTCOME_PROMISE');
  if (/\b(?:I|we)\s+(?:will|shall|am going to)\s+(?:kill|hurt|harm|attack|destroy|ruin)|\bpay\b.{0,50}\bor else\b/iu.test(text)) violations.push('THREAT');
  return violations;
}
export function placeholderNames(body:string) { return [...new Set(Array.from(body.matchAll(/\[\[FIELD:\s*([^\]]+)\]\]/g),m => m[1].trim()))]; }
export function displayValue(fact:Pick<Fact,'kind'|'value'>):string {
  if (fact.kind==='amount') return `INR ${(fact.value as {inr:number}).inr.toLocaleString('en-IN')}`;
  if (fact.kind==='date') return (fact.value as {date:string}).date;
  return String(fact.value);
}
export function renderDraft(snapshot:Snapshot,facts:FactRow[],purpose:string,tone:string) {
  const recipient=facts.find(f => ['recipient_name','landlord_name','seller_name','other_party_name'].includes(f.key));
  const author=facts.find(f => ['your_name','user_name'].includes(f.key));
  const outcome=facts.find(f => f.key==='desired_outcome');
  const clean=(fact:FactRow|undefined,label:string) => fact && legalLint(displayValue(fact)).length===0 ? displayValue(fact) : `[[FIELD: ${label}]]`;
  const role=facts.find(f => f.key==='user_role')?.value;
  const opening=purpose==='consultation_summary' ? 'These are the facts recorded for consultation.' : role==='helper' ? 'I am helping organise this account and request a review of the recorded facts.' : role==='other_side' ? 'I would like to respond to the concern and record the facts below.' : purpose==='follow_up' ? 'I am following up on the requested response.' : purpose==='grievance' ? 'I would like to record my concern and request a response.' : tone==='firm' ? 'I request a clear written response to the facts below.' : 'I would appreciate your review of the facts below.';
  const derived=derivedAmounts(facts);
  const lines=facts.filter(f => !['recipient_name','landlord_name','seller_name','other_party_name','your_name','user_name','desired_outcome','user_role'].includes(f.key)).map(f => `${legalLint(f.label).length ? f.key : f.label}: ${clean(f,`Review wording for ${f.key}`)}`);
  const unknown=snapshot.facts.filter(f => f.status==='unknown').map(f => `${f.label}: [[FIELD: ${f.label}]]`);
  const body=`${purpose==='consultation_summary' ? 'Consultation summary' : `To ${clean(recipient,'Recipient name')}`}\n\n${opening}\n\n${[...lines,...unknown].join('\n')}\n${derived.amount_remaining ? `Amount remaining (calculated): INR ${derived.amount_remaining.inr.toLocaleString('en-IN')}\n` : ''}\nRequested response: ${clean(outcome,'Requested response')}\n\nThank you,\n${clean(author,'Your name')}`;
  return {body,placeholders:placeholderNames(body)};
}
export function checkReadiness(draft:{body:string;facts_hash:string;purpose:string},snapshot:Snapshot,documentCount:number) {
  const placeholders=placeholderNames(draft.body),stale=draft.facts_hash!==hashFacts(snapshot.facts);
  const issues:{code:'EMPTY_DRAFT'|'PLACEHOLDERS'|'STALE_FACTS'|'AMOUNT_MISMATCH'|'MISSING_OUTCOME'|'MISSING_RECIPIENT'|'MISSING_ATTACHMENT'|'UNSAFE_WORDING';message:string}[]=[];
  if (!draft.body.trim()) issues.push({code:'EMPTY_DRAFT',message:'Add draft text before sending.'});
  if (placeholders.length) issues.push({code:'PLACEHOLDERS',message:`Complete these fields: ${placeholders.join(', ')}.`});
  if (stale) issues.push({code:'STALE_FACTS',message:'Confirmed facts changed. Review or regenerate this draft.'});
  const recipient=/^(?:To|Dear|Recipient)\s*:?[ \t]+([^\r\n]+)$/im.exec(draft.body)?.[1]?.trim();
  if (draft.purpose!=='consultation_summary' && (!recipient || recipient.includes('[[FIELD:'))) issues.push({code:'MISSING_RECIPIENT',message:'Name the recipient of this draft.'});
  const outcome=/^Requested response:[ \t]*([^\r\n]+)$/im.exec(draft.body)?.[1]?.trim();
  const desired=snapshot.facts.find(f => f.key==='desired_outcome' && f.status==='confirmed' && typeof f.value==='string')?.value as string|undefined;
  if ((!outcome || outcome.includes('[[FIELD:')) && !(desired && draft.body.includes(desired))) issues.push({code:'MISSING_OUTCOME',message:'State what response or outcome you are requesting.'});
  const amounts=new Set(snapshot.facts.filter(f => f.status==='confirmed' && f.kind==='amount').map(f => (f.value as {inr:number}).inr));
  try { const remaining=derivedAmounts(snapshot.facts).amount_remaining; if (remaining) amounts.add(remaining.inr); } catch { issues.push({code:'AMOUNT_MISMATCH',message:'Resolve the conflicting ledger amounts.'}); }
  const matches=[...draft.body.matchAll(/(?:₹|\bINR\b|\bRs\.?)[ \t]*([\d,]+(?:\.\d+)?)/gi),...draft.body.matchAll(/"inr"\s*:\s*(\d+)/g)];
  if (matches.some(m => !amounts.has(Number(m[1].replaceAll(',',''))))) issues.push({code:'AMOUNT_MISMATCH',message:'An amount in this draft differs from the confirmed ledger. Review it before sending.'});
  for (const fact of snapshot.facts.filter(f => f.status==='confirmed' && f.kind==='amount')) {
    const escaped=fact.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const amount=new RegExp(`^${escaped}:[ \\t]*(?:₹|INR|Rs\\.?)[ \\t]*([\\d,]+(?:\\.\\d+)?)`,'im').exec(draft.body)?.[1];
    if (amount && Number(amount.replaceAll(',',''))!==(fact.value as {inr:number}).inr) issues.push({code:'AMOUNT_MISMATCH',message:`The ${fact.label} amount differs from the confirmed fact.`});
  }
  if (/\b(?:attached|enclosed|attachment)\b/i.test(draft.body) && documentCount===0) issues.push({code:'MISSING_ATTACHMENT',message:'The draft refers to an attachment, but no uploaded document is available.'});
  if (legalLint(draft.body).length) issues.push({code:'UNSAFE_WORDING',message:'Review threatening language, outcome promises or unsupported legal citations.'});
  return readinessResponseSchema.parse({placeholders,stale,ready:issues.length===0,issues});
}
