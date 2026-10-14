select jsonb_build_object(
  'service_count', (select count(*) from public.service_catalog),
  'slot_count', (select count(*) from public.appointment_slots),
  'default_slot_capacity', (select min(capacity) from public.appointment_slots),
  'booking_window_days', (select booking_days_ahead from public.office_settings where id = 1),
  'validation_trigger', exists(select 1 from pg_trigger where tgname = 'validate_appointment' and not tgisinternal),
  'history_trigger', exists(select 1 from pg_trigger where tgname = 'appointment_history' and not tgisinternal),
  'private_tables_have_rls', (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.request_events'::regclass, 'public.certificate_deliveries'::regclass,
    'public.delivery_tracking_settings'::regclass, 'public.email_webhook_events'::regclass
  )),
  'private_webhook_table_blocked_for_residents', not has_table_privilege('authenticated', 'public.delivery_tracking_settings', 'SELECT'),
  'availability_function', to_regprocedure('public.get_slot_availability(date)') is not null,
  'softcopy_without_supported_template', (select count(*) from public.service_catalog where softcopy_available and request_type in ('Good Moral Certificate', 'Community Tax Certificate (Cedula)', 'Certificate of No Business', 'Certificate of No Property', 'Other barangay document'))
) as verification;
