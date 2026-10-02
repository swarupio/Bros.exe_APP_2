-- Executed by the embedded PostgreSQL test runner; may also be run in
-- Supabase SQL Editor against a disposable project. All fixtures roll back.
begin;
insert into auth.users(id) values
 ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.cases(id,user_id,original_account) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','My rental deposit has not been returned.'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','My consumer purchase arrived damaged.');
insert into public.facts(case_id,key,label,kind,value,status,source_type) values
 ('20000000-0000-4000-8000-000000000001','amount_paid','Paid','amount','{"inr":50000}','confirmed','user');
insert into storage.objects(bucket_id,name) values
 ('case-evidence','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/evidence');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.cases)<>1 then raise exception 'Case isolation failed'; end if;
  if exists(select 1 from public.facts) then raise exception 'Fact isolation failed'; end if;
  if exists(select 1 from storage.objects) then raise exception 'Storage read isolation failed'; end if;
  begin
    insert into storage.objects(bucket_id,name) values
      ('case-evidence','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/injected');
    raise exception 'Storage cross-case insertion succeeded';
  exception when insufficient_privilege then null; end;
  if public.owns_evidence_path('10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/file') then
    raise exception 'Storage case isolation failed'; end if;
  begin
    insert into public.facts(case_id,key,label,kind,value,status,source_type) values
      ('20000000-0000-4000-8000-000000000001','injected','Injected','text','"x"','confirmed','user');
    raise exception 'Cross-user fact insertion succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare c public.cases; p public.plan_revisions; begin
  select * into c from public.cases where id='20000000-0000-4000-8000-000000000001';
  begin
    perform public.lock_case_revision(c.id,c.user_id,c.rev-1);
    raise exception 'Stale revision accepted';
  exception when raise_exception then if sqlerrm<>'STALE_CASE' then raise; end if; end;
  p := public.commit_plan(c.id,c.user_id,c.rev,'30000000-0000-4000-8000-000000000001','initial','test-hash','{}',true);
  if p.revision<>1 then raise exception 'Plan revision failed'; end if;
  select * into c from public.cases where id=c.id;
  begin
    perform public.commit_plan(c.id,c.user_id,c.rev,'30000000-0000-4000-8000-000000000001','update','test-hash','{}',true);
    raise exception 'Duplicate request accepted';
  exception when unique_violation then null; end;
  perform public.mark_case_deleted(c.id,c.user_id,c.rev);
  begin
    perform public.lock_case_revision(c.id,c.user_id,c.rev+1);
    raise exception 'Deleted case accepted';
  exception when raise_exception then if sqlerrm<>'STALE_CASE' then raise; end if; end;
end $$;
rollback;
