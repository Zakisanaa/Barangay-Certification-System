-- Read-only verification; do not print private audit rows or account identifiers.
begin;
do $$ begin perform set_config('request.jwt.claim.sub',(
 select p.id::text from public.resident_profiles p join public.staff_access a on a.user_id=p.id
 where p.role='staff' and a.active and (a.superadmin or 'audit'=any(a.permissions))
 order by a.superadmin desc limit 1
),true);
perform set_config('request.jwt.claim.role','authenticated',true);end;$$;
set local role authenticated;
select jsonb_build_object(
 'audit_loaded',result ? 'rows',
 'returned_records',jsonb_array_length(result->'rows'),
 'total_records',result->'total',
 'list_uses_rls',not (select prosecdef from pg_proc where oid='public.office_record_list(text,integer,text,text,text,text)'::regprocedure),
 'internal_helper_stays_private',not has_function_privilege('authenticated','public.require_staff_permission(text)','execute')
) as checks from (select public.office_record_list('audit') result) checked;
rollback;
