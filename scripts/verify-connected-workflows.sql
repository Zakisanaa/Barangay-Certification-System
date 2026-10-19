select jsonb_build_object(
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261019001000'),
 'picker_exists',to_regprocedure('public.office_transaction_list(text,integer,text,text,text)') is not null,
 'authenticated_picker_access',has_function_privilege('authenticated','public.office_transaction_list(text,integer,text,text,text)','EXECUTE'),
 'anonymous_picker_denied',not has_function_privilege('anon','public.office_transaction_list(text,integer,text,text,text)','EXECUTE'),
 'internal_projection_not_exposed',not has_function_privilege('authenticated','public.office_transaction_rows()','EXECUTE') and not has_function_privilege('anon','public.office_transaction_rows()','EXECUTE'),
 'fee_tracking_enabled',(select fee_tracking_enabled from public.office_settings where id=1),
 'eligible_appointments',(select count(*) from public.appointment_requests where status in ('APPROVED','COMPLETED') and not archived),
 'appointments_awaiting_first_fee_record',(select count(*) from public.appointment_requests r where r.status in ('APPROVED','COMPLETED') and not r.archived and not exists(select 1 from public.fee_records f where f.request_reference=r.reference)),
 'requests_rls_enabled',(select relrowsecurity from pg_class where oid='public.appointment_requests'::regclass),
 'fees_rls_enabled',(select relrowsecurity from pg_class where oid='public.fee_records'::regclass)
) as verification;
