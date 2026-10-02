-- S-002 / CASE-1: ownership, private evidence and atomic concurrency seams.
begin;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  ui_lang text not null default 'en' check (ui_lang in ('en','hi','mr')),
  explain_lang text not null default 'en' check (explain_lang in ('en','hi','mr')),
  draft_lang text not null default 'en' check (draft_lang in ('en','hi','mr')),
  hide_previews boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default 'New case',
  original_account text not null check (char_length(original_account) between 20 and 3000),
  original_lang text, issue_tags text[] not null default '{}', pack_id text,
  urgency text not null default 'none' check (urgency in ('none','elevated','urgent')),
  status text not null default 'open' check (status in ('open','resolved','archived')),
  current_plan_revision integer, rev integer not null default 1 check (rev > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index cases_owner_updated on public.cases(user_id, updated_at desc);
create table public.facts (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'), label text not null,
  kind text not null check (kind in ('amount','date','party','place','bool','enum','text')),
  value jsonb, raw_text text,
  status text not null check (status in ('proposed','confirmed','disputed','unknown')),
  source_type text not null check (source_type in ('user','document','calculated','ai_inferred')),
  source_ref jsonb, supersedes_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (case_id,id),
  foreign key (case_id,supersedes_id) references public.facts(case_id,id)
);
create index facts_case_key on public.facts(case_id,key);
create index facts_case_status on public.facts(case_id,status);
create table public.documents (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases on delete cascade,
  storage_path text not null unique, file_name text not null, mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 5242880), sha256 text,
  status text not null default 'uploading' check (status in ('uploading','uploaded','analyzing','analyzed','failed')),
  error_code text, pages_total integer check (pages_total > 0), pages_read integer check (pages_read >= 0),
  analysis jsonb, created_at timestamptz not null default now(), unique(case_id,id),
  check (pages_read <= pages_total)
);
create table public.checklist_state (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases on delete cascade,
  item_key text not null, status text not null check (status in ('have','dont_have','unsure')),
  document_id uuid, updated_at timestamptz not null default now(), unique(case_id,item_key),
  foreign key (case_id,document_id) references public.documents(case_id,id)
);
create table public.plan_revisions (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases on delete cascade,
  revision integer not null check (revision > 0), trigger text not null check (trigger in ('initial','update')),
  facts_hash text not null, content jsonb not null, sources jsonb not null default '[]'::jsonb, change_summary jsonb, pack_version text, model text,
  fallback_used boolean not null default false, created_at timestamptz not null default now(),
  unique(case_id,revision)
);
alter table public.cases add constraint cases_current_plan_fk
  foreign key (id,current_plan_revision) references public.plan_revisions(case_id,revision) deferrable initially deferred;
create table public.drafts (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases on delete cascade,
  purpose text not null check (purpose in ('request','grievance','follow_up','consultation_summary')),
  language text not null check (language in ('en','hi','mr')),
  version integer not null check (version > 0), save_token integer not null default 1 check (save_token > 0),
  body text not null, facts_hash text not null, plan_revision integer,
  edited_by_user boolean not null default false,
  status text not null default 'draft_prepared' check (status in ('draft_prepared','user_reports_sent')),
  is_current boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(case_id,purpose,version),
  foreign key (case_id,plan_revision) references public.plan_revisions(case_id,revision)
);
create unique index drafts_one_current on public.drafts(case_id,purpose) where is_current;
create table public.case_updates (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases on delete cascade,
  outcome text not null check (outcome in ('no_response','reply_received','partially_resolved','asked_for_information','situation_changed','resolved','note_only')),
  note text check (char_length(note) <= 500), document_id uuid, plan_revision_after integer,
  created_at timestamptz not null default now(),
  foreign key (case_id,document_id) references public.documents(case_id,id),
  foreign key (case_id,plan_revision_after) references public.plan_revisions(case_id,revision)
);
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
  user_id uuid not null references auth.users on delete cascade, case_id uuid references public.cases on delete cascade,
  kind text not null check (kind in ('intake','plan','draft','analyze','update','stt','check')),
  status text not null check (status in ('pending','ok','error','stale','fallback')),
  error_code text, latency_ms integer check (latency_ms >= 0),
  tokens_in integer check (tokens_in >= 0), tokens_out integer check (tokens_out >= 0),
  created_at timestamptz not null default now()
);
create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  case_id uuid references public.cases on delete cascade,
  target_type text not null check (target_type in ('plan_item','source','resource','translation','other')),
  target_ref text, reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz not null default now()
);

create function public.owns_live_case(p_case_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.cases where id=p_case_id and user_id=auth.uid() and deleted_at is null)
$$;
revoke all on function public.owns_live_case(uuid) from public;
grant execute on function public.owns_live_case(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.feedback_reports enable row level security;
alter table public.ai_requests enable row level security;
create policy profile_owner on public.profiles for all to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy case_read on public.cases for select to authenticated using (user_id=auth.uid() and deleted_at is null);
create policy case_create on public.cases for insert to authenticated with check (user_id=auth.uid() and deleted_at is null and rev=1 and current_plan_revision is null);
create policy case_edit on public.cases for update to authenticated using (user_id=auth.uid() and deleted_at is null) with check (user_id=auth.uid() and deleted_at is null);
create policy feedback_owner on public.feedback_reports for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid() and (case_id is null or public.owns_live_case(case_id)));
do $$ declare t text; begin
  foreach t in array array['facts','documents','checklist_state','plan_revisions','drafts','case_updates'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_read on public.%I for select to authenticated using (public.owns_live_case(case_id))',t);
  end loop;
  foreach t in array array['facts','checklist_state'] loop
    execute format('create policy owner_write on public.%I for all to authenticated using (public.owns_live_case(case_id)) with check (public.owns_live_case(case_id))',t);
  end loop;
end $$;
-- Explicit privileges: privileged AI output cannot be inserted directly by clients.
revoke all on public.profiles,public.cases,public.facts,public.documents,public.checklist_state,public.plan_revisions,public.drafts,public.case_updates,public.ai_requests,public.feedback_reports from anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.cases to authenticated;
grant insert(id,user_id,title,original_account) on public.cases to authenticated;
grant update(title,status) on public.cases to authenticated;
grant select,insert,update,delete on public.facts,public.checklist_state to authenticated;
grant select on public.documents,public.plan_revisions,public.drafts,public.case_updates to authenticated;
grant select,insert on public.feedback_reports to authenticated;
grant all on public.profiles,public.cases,public.facts,public.documents,public.checklist_state,public.plan_revisions,public.drafts,public.case_updates,public.ai_requests,public.feedback_reports to service_role;

create function public.guard_case() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.original_account is distinct from old.original_account then
    raise exception 'IMMUTABLE_CASE';
  end if;
  if old.deleted_at is not null then raise exception 'STALE_CASE'; end if;
  new.rev := old.rev+1; new.updated_at := now(); return new;
end $$;
create trigger guard_case before update on public.cases for each row execute function public.guard_case();

-- Lock the parent before every ledger mutation. Inference commits use the same lock.
create function public.touch_fact_case() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_case uuid; begin
  if tg_op='UPDATE' and new.case_id is distinct from old.case_id then raise exception 'IMMUTABLE_CASE_LINK'; end if;
  if tg_op='DELETE' then v_case := old.case_id; else v_case := new.case_id; end if;
  update public.cases set updated_at=now() where id=v_case and deleted_at is null;
  if not found then
    -- Parent already removed during an authorized cascading hard delete.
    if tg_op='DELETE' and not exists(select 1 from public.cases where id=v_case) then return old; end if;
    raise exception 'STALE_CASE';
  end if;
  if tg_op='DELETE' then return old; end if;
  new.updated_at := now(); return new;
end $$;
create trigger touch_fact_case before insert or update or delete on public.facts for each row execute function public.touch_fact_case();

-- Service-only lock primitive: call inside an RPC transaction, never as a separate HTTP request.
create function public.lock_case_revision(p_case_id uuid,p_user_id uuid,p_expected_rev integer)
returns public.cases language plpgsql set search_path = '' as $$
declare c public.cases; begin
  select * into c from public.cases where id=p_case_id and user_id=p_user_id for update;
  if not found or c.deleted_at is not null or c.rev<>p_expected_rev then raise exception 'STALE_CASE' using errcode='P0001'; end if;
  return c;
end $$;
revoke all on function public.lock_case_revision(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.lock_case_revision(uuid,uuid,integer) to service_role;

-- The revision comparison and insertion share one transaction and parent lock.
-- Only schema/claim-validated content may reach this service-only RPC.
create function public.commit_plan(p_case_id uuid,p_user_id uuid,p_expected_rev integer,
  p_request_id uuid,p_trigger text,p_facts_hash text,p_content jsonb,p_fallback boolean)
returns public.plan_revisions language plpgsql set search_path = '' as $$
declare c public.cases; p public.plan_revisions; next_revision integer; begin
  c := public.lock_case_revision(p_case_id,p_user_id,p_expected_rev);
  if not exists(select 1 from public.facts where case_id=p_case_id and status='confirmed')
    or exists(select 1 from public.facts where case_id=p_case_id and status='disputed') then
    raise exception 'FACTS_NOT_CONFIRMED';
  end if;
  insert into public.ai_requests(request_id,user_id,case_id,kind,status)
    values(p_request_id,p_user_id,p_case_id,'plan',case when p_fallback then 'fallback' else 'ok' end);
  select coalesce(max(revision),0)+1 into next_revision from public.plan_revisions where case_id=p_case_id;
  insert into public.plan_revisions(case_id,revision,trigger,facts_hash,content,fallback_used)
    values(p_case_id,next_revision,p_trigger,p_facts_hash,p_content,p_fallback) returning * into p;
  update public.cases set current_plan_revision=next_revision where id=p_case_id;
  return p;
end $$;
revoke all on function public.commit_plan(uuid,uuid,integer,uuid,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.commit_plan(uuid,uuid,integer,uuid,text,text,jsonb,boolean) to service_role;

create function public.mark_case_deleted(p_case_id uuid,p_user_id uuid,p_expected_rev integer)
returns void language plpgsql set search_path = '' as $$
begin
  perform public.lock_case_revision(p_case_id,p_user_id,p_expected_rev);
  update public.cases set deleted_at=now() where id=p_case_id;
end $$;
revoke all on function public.mark_case_deleted(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.mark_case_deleted(uuid,uuid,integer) to service_role;

create function public.save_draft(p_draft_id uuid,p_expected_token integer,p_body text,p_status text default 'draft_prepared')
returns public.drafts language plpgsql security definer set search_path = '' as $$
declare d public.drafts; begin
  -- Parent first: the same lock order as generation and deletion.
  perform 1 from public.cases c join public.drafts x on x.case_id=c.id
    where x.id=p_draft_id and c.user_id=auth.uid() and c.deleted_at is null for update of c;
  if not found then raise exception 'STALE_CASE'; end if;
  select * into d from public.drafts where id=p_draft_id for update;
  if d.save_token<>p_expected_token or not d.is_current then raise exception 'DRAFT_CONFLICT'; end if;
  if d.status='user_reports_sent' then raise exception 'DRAFT_FROZEN'; end if;
  if p_body is null or char_length(p_body)>20000 or p_status not in ('draft_prepared','user_reports_sent') or p_status is null then raise exception 'INVALID_DRAFT'; end if;
  update public.drafts set body=p_body,status=p_status,edited_by_user=true,
    save_token=save_token+1,updated_at=now() where id=p_draft_id returning * into d;
  return d;
end $$;
revoke all on function public.save_draft(uuid,integer,text,text) from public,anon;
grant execute on function public.save_draft(uuid,integer,text,text) to authenticated;

create function public.reject_plan_edit() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'IMMUTABLE_PLAN'; end $$;
create trigger immutable_plan before update on public.plan_revisions for each row execute function public.reject_plan_edit();

create function public.guard_draft() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.case_id is distinct from old.case_id or new.version is distinct from old.version
    or new.purpose is distinct from old.purpose or new.facts_hash is distinct from old.facts_hash then
    raise exception 'IMMUTABLE_DRAFT_VERSION';
  end if;
  -- Retiring a sent version on regeneration is allowed; its text remains frozen.
  if old.status='user_reports_sent' and (new.body is distinct from old.body or new.status is distinct from old.status) then
    raise exception 'DRAFT_FROZEN';
  end if;
  return new;
end $$;
create trigger guard_draft before update on public.drafts for each row execute function public.guard_draft();

insert into storage.buckets(id,name,public,file_size_limit)
  values ('case-evidence','case-evidence',false,5242880);
-- Check both the user prefix and the case prefix; deleted cases cannot accept uploads.
create function public.owns_evidence_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(p_name,'/',1)=auth.uid()::text and exists(
    select 1 from public.cases c where c.id::text=split_part(p_name,'/',2)
      and c.user_id=auth.uid() and c.deleted_at is null)
$$;
revoke all on function public.owns_evidence_path(text) from public;
grant execute on function public.owns_evidence_path(text) to authenticated;
create policy evidence_read on storage.objects for select to authenticated
  using (bucket_id='case-evidence' and public.owns_evidence_path(name));
create policy evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id='case-evidence' and public.owns_evidence_path(name));
create policy evidence_delete on storage.objects for delete to authenticated
  using (bucket_id='case-evidence' and public.owns_evidence_path(name));
commit;
