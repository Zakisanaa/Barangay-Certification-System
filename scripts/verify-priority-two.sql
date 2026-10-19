select jsonb_build_object(
 'migration',exists(select 1 from supabase_migrations.schema_migrations where version='20261019000200'),
 'private_list_guard_migration',exists(select 1 from supabase_migrations.schema_migrations where version='20261019000300'),
 'structured_identity_columns',(select count(*)=5 from information_schema.columns where table_schema='public' and table_name='appointment_requests' and column_name in ('id_type','id_number','id_review_acknowledged','id_acknowledgment_version','id_acknowledged_at')),
 'identity_guard',exists(select 1 from pg_trigger where tgrelid='public.appointment_requests'::regclass and tgname='identity_request' and not tgisinternal),
 'versioned_tables',(select count(*) from information_schema.columns where table_schema='public' and column_name='revision' and table_name in ('resident_profiles','public_posts','walk_in_shifts','service_catalog','office_settings','office_closures','appointment_slots')),
 'concern_submission',to_regprocedure('public.submit_resident_concern(uuid,text,text,text)') is not null,
 'legacy_shift_ids_supported',to_regprocedure('public.save_walk_in_shift(text,text,text,text,text,boolean,integer)') is not null,
 'lists_keep_caller_rls',(select count(*)=2 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('portal_list','request_summary') and not p.prosecdef),
 'certificate_availability_consistent',not exists(select 1 from public.certificate_deliveries d where d.file_available is distinct from exists(select 1 from storage.objects o where o.bucket_id='completed-certificates' and o.name=d.storage_path)),
 'certificate_payload_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='certificate_deliveries' and column_name='email_payload')
) as verification;
