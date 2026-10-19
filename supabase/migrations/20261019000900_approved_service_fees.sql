begin;

-- Office-approved values supplied on 19 October 2026. This trusted migration
-- uses the existing service-role write path; it does not impersonate a resident.
set local request.jwt.claim.role = 'service_role';
select pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));

insert into public.service_catalog(request_type,requirements,fee_description,processing_time,softcopy_available)
values('Barangay Agrarian Certificate','Valid ID and proof of land ownership or tenancy.','Pay at the barangay office.','',false)
on conflict(request_type) do nothing;

update public.service_catalog set
 fee_amount=case when request_type in ('Certificate of Indigency','First-Time Job Seeker Certificate','Attestation') then 0 else 100 end,
 fee_description=case when request_type in ('Certificate of Indigency','First-Time Job Seeker Certificate','Attestation') then 'No service fee.' else 'Pay at the barangay office.' end,
 requirements=case
  when request_type='Good Moral Certificate' then 'Valid ID is required for booking. Additional requirements: None.'
  when request_type='Barangay Agrarian Certificate' then 'Valid ID: select its type, enter its number, and upload a readable photo. Also upload proof of land ownership or tenancy.'
  else 'Valid ID: select its type, enter its number, and upload a readable photo.' end;

insert into public.service_requirements(id,request_type,title,instructions,required,active)
values('ca318b92-ce77-4fe8-9ee7-a2a33a023c62','Barangay Agrarian Certificate','Proof of land ownership or tenancy','Upload proof of land ownership OR proof of tenancy. One readable PDF, JPG, PNG, or WebP, up to 5 MB.',true,true);

commit;
