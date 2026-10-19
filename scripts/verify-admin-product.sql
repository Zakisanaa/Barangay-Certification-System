select jsonb_build_object(
 'admin_migrations',(select count(*) from supabase_migrations.schema_migrations where version in ('20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261018000700','20261018000800')),
 'confirmed_active_superadmin',exists(select 1 from public.resident_profiles p join public.staff_access a on a.user_id=p.id join auth.users u on u.id=p.id where lower(p.email)='barangaylagasit813@gmail.com' and lower(u.email)=lower(p.email) and p.role='staff' and a.active and a.superadmin and u.email_confirmed_at is not null),
 'required_id_migration',exists(select 1 from supabase_migrations.schema_migrations where version='20261019000000'),
 'all_new_bookings_require_id',exists(select 1 from pg_trigger t where t.tgrelid='public.appointment_requests'::regclass and t.tgname='validate_appointment' and position('if nullif(btrim(new.school_id_image_path)' in pg_get_functiondef(t.tgfoid))>0),
 'conversation_attachment_migration',exists(select 1 from supabase_migrations.schema_migrations where version='20261019000100'),
 'chat_attachment_rls',exists(select 1 from pg_tables where schemaname='public' and tablename='chat_attachments' and rowsecurity),
 'private_chat_bucket',exists(select 1 from storage.buckets where id='conversation-attachments' and not public and file_size_limit=5242880 and cardinality(allowed_mime_types)=6),
 'chat_message_functions',to_regprocedure('public.send_transaction_message(text,uuid,text,jsonb)') is not null and to_regprocedure('public.send_concern_message(text,uuid,text,boolean,jsonb)') is not null and to_regprocedure('public.send_concern_message(text,uuid,text,boolean)') is null,
 'active_staff_accounts',(select count(*) from public.staff_access where active),
 'fee_tracking_enabled',(select fee_tracking_enabled from public.office_settings where id=1),
 'private_buckets',(select count(*) from storage.buckets where id in ('resident-school-ids','resident-evidence','request-attachments','certificate-templates','completed-certificates') and not public),
 'current_template_associations',(select count(*) from public.certificate_templates where active),
 'new_tables_with_rls',(select count(*) from pg_tables where schemaname='public' and rowsecurity and tablename in ('staff_access','audit_log','concern_events','concern_messages','staff_notifications','staff_notification_reads','resident_verifications','resident_evidence','walk_in_transactions','certificate_register','fee_records','site_content','service_requirements','certificate_templates','request_attachments','office_weekdays'))
) as verification;
