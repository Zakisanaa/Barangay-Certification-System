-- Inspect configuration without publishing content or uploading files.
begin read only;
select jsonb_build_object(
 'leadership_content_allowed',exists(select 1 from pg_constraint where conrelid='public.site_content'::regclass and conname='site_content_key_check' and pg_get_constraintdef(oid) like '%leadership%'),
 'publishing_requires_content_access',pg_get_functiondef('public.save_site_content(text,jsonb,integer)'::regprocedure) like '%require_staff_permission(''content'')%',
 'publishing_requires_uploaded_photo',pg_get_functiondef('public.save_site_content(text,jsonb,integer)'::regprocedure) like '%Upload the leadership image before publishing.%',
 'published_photo_cleanup_is_protected',pg_get_functiondef('public.can_remove_official_image(text)'::regprocedure) like '%c.key in (''leadership'',''mission'',''vision'')%',
 'mission_vision_images_supported',pg_get_functiondef('public.save_site_content(text,jsonb,integer)'::regprocedure) like '%Upload the mission or vision image before publishing.%',
 'anonymous_publishing_disabled',not has_function_privilege('anon','public.save_site_content(text,jsonb,integer)','execute'),
 'staff_publishing_available',has_function_privilege('authenticated','public.save_site_content(text,jsonb,integer)','execute'),
 'public_images_configured',exists(select 1 from storage.buckets where id='official-images' and public and file_size_limit=5242880 and allowed_mime_types @> array['image/jpeg','image/png','image/webp']),
 'public_content_has_rls',(select relrowsecurity from pg_class where oid='public.site_content'::regclass)
) as checks;
rollback;
