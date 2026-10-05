revoke update on public.resident_profiles from authenticated;
grant update (first_name, last_name, contact_number, address)
  on public.resident_profiles to authenticated;

create policy "Staff can update resident contact details"
  on public.resident_profiles for update to authenticated
  using ((select public.is_barangay_staff()) and role = 'resident')
  with check ((select public.is_barangay_staff()) and role = 'resident');
