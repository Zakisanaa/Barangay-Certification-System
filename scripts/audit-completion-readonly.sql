-- Read-only completion audit. Returns public configuration and aggregate counts,
-- never resident names, contacts, ID files, messages, or authentication secrets.
select jsonb_build_object(
 'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'office',(select jsonb_build_object('fee_tracking_enabled',fee_tracking_enabled,'booking_days_ahead',booking_days_ahead,'office_hours',office_hours,'has_phone',btrim(contact_number)<>'','has_email',btrim(contact_email)<>'','has_address',btrim(address)<>'') from public.office_settings where id=1),
 'services',(select jsonb_agg(jsonb_build_object('name',s.request_type,'active',s.active,'fee_amount',s.fee_amount,'fee_notes_present',btrim(s.fee_description)<>'','requirements_present',btrim(s.requirements)<>'','processing_time',s.processing_time,'softcopy_available',s.softcopy_available,'active_templates',(select count(*) from public.certificate_templates t where t.request_type=s.request_type and t.active),'required_uploads',(select count(*) from public.service_requirements r where r.request_type=s.request_type and r.active and r.required)) order by s.request_type) from public.service_catalog s),
 'public_content',(select coalesce(jsonb_agg(jsonb_build_object('key',key,'version',version,'contains_draft_wording',value::text ilike '%draft%' or value::text ilike '%pending%')),'[]') from public.site_content),
 'active_staff',(select count(*) from public.staff_access where active),
 'active_superadmins',(select count(*) from public.staff_access where active and superadmin),
 'payment_methods',(select count(*) from public.payment_methods),
 'active_payment_methods',(select count(*) from public.payment_methods where active),
 'notification_statuses',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from public.notification_outbox group by status)s),
 'mfa_schema_present',to_regclass('auth.mfa_factors') is not null,
 'cron_jobs',(select coalesce(jsonb_agg(jsonb_build_object('name',jobname,'active',active,'schedule',schedule)),'[]') from cron.job),
 'rls_disabled_public_tables',(select coalesce(jsonb_agg(tablename),'[]') from pg_tables where schemaname='public' and not rowsecurity)
) as completion_audit;
