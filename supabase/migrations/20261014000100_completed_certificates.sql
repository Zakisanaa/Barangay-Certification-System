insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'completed-certificates',
  'completed-certificates',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Barangay staff can read completed certificates"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'completed-certificates'
    and (select public.is_barangay_staff())
  );
