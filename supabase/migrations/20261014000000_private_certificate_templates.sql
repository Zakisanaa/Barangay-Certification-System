insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificate-templates',
  'certificate-templates',
  false,
  5242880,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Barangay staff can read certificate templates"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'certificate-templates'
    and (select public.is_barangay_staff())
  );
