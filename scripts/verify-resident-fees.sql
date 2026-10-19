select jsonb_build_object(
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261019000800'),
 'resident_fee_rpc_exists',to_regprocedure('public.resident_fee_records(integer,text,text)') is not null,
 'resident_fee_rpc_uses_rls',not(select prosecdef from pg_proc where oid='public.resident_fee_records(integer,text,text)'::regprocedure),
 'authenticated_history_access',has_function_privilege('authenticated','public.resident_fee_records(integer,text,text)','EXECUTE'),
 'anonymous_history_denied',not has_function_privilege('anon','public.resident_fee_records(integer,text,text)','EXECUTE'),
 'fee_records_rls',(select relrowsecurity from pg_class where oid='public.fee_records'::regclass),
 'appointment_ownership_rls',(select relrowsecurity from pg_class where oid='public.appointment_requests'::regclass),
 'fee_record_realtime',exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='fee_records'),
 'fee_tracking_enabled',(select fee_tracking_enabled from public.office_settings where id=1),
 'appointment_linked_entries',(select count(*) from public.fee_records where request_reference is not null),
 'unlinked_walk_in_entries',(select count(*) from public.fee_records where walk_in_id is not null)
) as verification;
