-- S-002/S-005: keep superseded facts, bound direct-client writes, serialize uploads.
begin;
alter table public.facts add column retired_at timestamptz;
create index facts_active_case on public.facts(case_id,key) where retired_at is null;
revoke insert,update,delete on public.facts from authenticated;
-- Browser clients use revision-checked API mutations for fact review.
drop policy owner_write on public.facts;
alter table public.facts add constraint fact_key_length check(char_length(key)<=80);
alter table public.facts add constraint fact_label_length check(char_length(btrim(label)) between 1 and 160);
alter table public.cases add constraint account_nonblank check (char_length(btrim(original_account)) >= 20);
alter table public.cases add constraint case_title_length check (char_length(btrim(title)) between 1 and 120);

create function public.can_insert_evidence(p_name text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin
  -- Flat user/case/UUID paths only. Policy holds a parent SHARE lock until the
  -- object transaction ends; soft deletion cannot race a policy-approved upload.
  if p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'
    or split_part(p_name,'/',1)<>auth.uid()::text then return false; end if;
  perform 1 from public.cases c where c.id::text=split_part(p_name,'/',2)
    and c.user_id=auth.uid() and c.deleted_at is null for share;
  return found;
end $$;
revoke all on function public.can_insert_evidence(text) from public;
grant execute on function public.can_insert_evidence(text) to authenticated;
drop policy evidence_insert on storage.objects;
create policy evidence_insert on storage.objects for insert to authenticated
  with check(bucket_id='case-evidence' and public.can_insert_evidence(name));

create or replace function public.save_draft(p_draft_id uuid,p_expected_token integer,p_body text,p_status text default 'draft_prepared')
returns public.drafts language plpgsql security definer set search_path='' as $$
declare d public.drafts; begin
  perform 1 from public.cases c join public.drafts x on x.case_id=c.id
    where x.id=p_draft_id and c.user_id=auth.uid() and c.deleted_at is null for update of c;
  if not found then raise exception 'STALE_CASE'; end if;
  select * into d from public.drafts where id=p_draft_id for update;
  if d.save_token<>p_expected_token or not d.is_current then raise exception 'DRAFT_CONFLICT'; end if;
  if d.status='user_reports_sent' then raise exception 'DRAFT_FROZEN'; end if;
  if p_body is null or char_length(p_body)>20000 or p_status not in ('draft_prepared','user_reports_sent') or p_status is null then raise exception 'INVALID_DRAFT'; end if;
  update public.drafts set body=p_body,status=p_status,edited_by_user=true,
    save_token=save_token+1,updated_at=now() where id=p_draft_id returning * into d;
  update public.cases set updated_at=now() where id=d.case_id;
  return d;
end $$;

-- Keep direct RPC callers on the same current-ledger gate as Prisma workflows.
create or replace function public.commit_plan(p_case_id uuid,p_user_id uuid,p_expected_rev integer,
  p_request_id uuid,p_trigger text,p_facts_hash text,p_content jsonb,p_fallback boolean)
returns public.plan_revisions language plpgsql set search_path='' as $$
declare c public.cases; p public.plan_revisions; next_revision integer; begin
  c := public.lock_case_revision(p_case_id,p_user_id,p_expected_rev);
  if not exists(select 1 from public.facts where case_id=p_case_id and status='confirmed' and retired_at is null)
    or exists(select 1 from public.facts where case_id=p_case_id and status='disputed' and retired_at is null)
    or exists(select 1 from public.facts where case_id=p_case_id and retired_at is null and status in ('confirmed','proposed') group by key having count(distinct value)>1)
    then raise exception 'FACTS_NOT_CONFIRMED'; end if;
  insert into public.ai_requests(request_id,user_id,case_id,kind,status)
    values(p_request_id,p_user_id,p_case_id,'plan',case when p_fallback then 'fallback' else 'ok' end);
  select coalesce(max(revision),0)+1 into next_revision from public.plan_revisions where case_id=p_case_id;
  insert into public.plan_revisions(case_id,revision,trigger,facts_hash,content,fallback_used)
    values(p_case_id,next_revision,p_trigger,p_facts_hash,p_content,p_fallback) returning * into p;
  update public.cases set current_plan_revision=next_revision where id=p_case_id;
  return p;
end $$;
commit;
