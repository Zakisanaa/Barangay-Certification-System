alter table public.appointment_requests
  add column if not exists school_id_image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resident-school-ids', 'resident-school-ids', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Residents upload own school ID images" on storage.objects;
create policy "Residents upload own school ID images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resident-school-ids'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Staff view school ID images" on storage.objects;
create policy "Staff view school ID images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'resident-school-ids'
    and (select public.is_barangay_staff())
  );

drop policy if exists "Residents remove unsubmitted school ID images" on storage.objects;
create policy "Residents remove unsubmitted school ID images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resident-school-ids'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
