-- Aggregate-only security/operations read; no account identifiers or secrets.
select jsonb_build_object(
 'active_staff',(select count(*) from public.staff_access where active),
 'staff_with_verified_mfa',(select count(distinct a.user_id) from public.staff_access a join auth.mfa_factors f on f.user_id=a.user_id where a.active and f.status='verified'),
 'superadmins_with_verified_mfa',(select count(distinct a.user_id) from public.staff_access a join auth.mfa_factors f on f.user_id=a.user_id where a.active and a.superadmin and f.status='verified'),
 'unconfirmed_accounts',(select count(*) from auth.users where email_confirmed_at is null),
 'auth_confirmation_setting_tables',(select coalesce(jsonb_agg(table_name),'[]') from information_schema.tables where table_schema='auth' and table_name in ('config','settings')),
 'recent_cron_runs',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from cron.job_run_details where start_time>now()-interval '1 day' group by status) s),
 'last_successful_cron_run',(select max(start_time) from cron.job_run_details where status='succeeded'),
 'recent_failed_cron_runs',(select coalesce(jsonb_agg(jsonb_build_object('started',start_time,'category',case when return_message ilike '%restart%' then 'database restart' when return_message ilike '%cancel%' then 'cancelled' when return_message ilike '%timeout%' or return_message ilike '%timed out%' then 'timeout' when return_message ilike '%connection%' or return_message ilike '%server closed%' then 'connection failure' when return_message ilike '%permission%' then 'permission error' else 'Other: details require log review' end) order by start_time desc),'[]') from cron.job_run_details where status='failed' and start_time>now()-interval '1 day'),
 'draft_public_defaults',(select count(*) from public.site_content where value::text ilike '%draft%' or value::text ilike '%pending%'),
 'active_service_count',(select count(*) from public.service_catalog where active),
 'active_services_without_numeric_fees',(select count(*) from public.service_catalog where active and fee_amount is null),
 'active_services_without_requirements',(select count(*) from public.service_catalog where active and btrim(requirements)=''),
 'active_services_without_processing_times',(select count(*) from public.service_catalog where active and btrim(processing_time)=''),
 'active_required_upload_checklists',(select count(*) from public.service_requirements where active and required),
 'active_services_without_templates',(select count(*) from public.service_catalog s where active and not exists(select 1 from public.certificate_templates t where t.request_type=s.request_type and t.active)),
 'public_service_fee_notes',(select coalesce(jsonb_agg(jsonb_build_object('service',request_type,'fee_description',fee_description)),'[]') from public.service_catalog where active and btrim(fee_description)<>'')
) as security_and_readiness;
