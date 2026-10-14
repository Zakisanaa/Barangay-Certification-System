import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

let db;
const residentA = '00000000-0000-4000-8000-000000000001';
const residentB = '00000000-0000-4000-8000-000000000002';
const staff = '00000000-0000-4000-8000-000000000003';
let day;
let sequence = 0;
const asUser = async (id, role = 'authenticated') => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [id, role]);
  await db.exec(`set role ${role}`);
};
const submit = async (overrides = {}) => {
  const row = { reference: `TEST-${++sequence}`, owner: residentA, date: day, slot: '8:00 AM - 9:00 AM', type: 'Barangay Clearance', format: 'Softcopy', status: 'PENDING', ...overrides };
  await db.query(`insert into public.appointment_requests(reference, owner_id, full_name, address, voter_id, request_type, purpose, appointment_date, time_slot, delivery_format, status, archived) values ($1,$2,'Juan Dela Cruz','Lagasit','Voter ID 123',$3,'Employment',$4,$5,$6,$7,false)`, [row.reference, row.owner, row.type, row.date, row.slot, row.format, row.status]);
  return row.reference;
};
before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'service_role') $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
    create schema storage;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, service_role;
    grant select on storage.objects to authenticated;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create publication supabase_realtime;
  `);
  const migrationNames = [
    '20261005000000_initial_schema.sql', '20261005000200_staff_edit_resident_profiles.sql',
    '20261005000300_school_id_image_upload.sql', '20261005000400_archive_requests_and_concerns.sql',
    '20261014000000_private_certificate_templates.sql', '20261014000100_completed_certificates.sql',
    '20261015000000_booking_and_request_history.sql',
  ];
  // PGlite has native gen_random_uuid; the existing optional pgcrypto extension is not required here.
  for (const name of migrationNames) {
    const sql = (await fs.readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).replace('create extension if not exists pgcrypto;', '');
    await db.exec(sql);
  }
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,'a@example.test','{"first_name":"Resident A"}'),($2,'b@example.test','{"first_name":"Resident B"}'),($3,'staff@example.test','{"first_name":"Staff"}')`, [residentA, residentB, staff]);
  await db.query("update public.resident_profiles set role = 'staff' where id = $1", [staff]);
  day = (await db.query(`select day::date::text as day from generate_series((now() at time zone 'Asia/Manila')::date + 1, (now() at time zone 'Asia/Manila')::date + 7, '1 day') day where extract(isodow from day) < 6 limit 1`)).rows[0].day;
});
after(async () => { await db?.close(); });

test('database rejects a resident-created approved request and a forged owner', async () => {
  await asUser(residentA);
  await assert.rejects(submit({ status: 'APPROVED' }), /Pending/);
  await assert.rejects(submit({ owner: residentB }), /row-level security/);
});

test('booking rejects past dates, weekends, closures, invalid slots, and unavailable softcopies', async () => {
  await asUser(residentA);
  await assert.rejects(submit({ date: '2000-01-01' }), /weekday|window/);
  const weekend = (await db.query(`select day::date::text as day from generate_series($1::date, $1::date + 7, '1 day') day where extract(isodow from day) = 6 limit 1`, [day])).rows[0].day;
  await assert.rejects(submit({ date: weekend }), /weekday/);
  await assert.rejects(submit({ slot: 'midnight' }), /valid upcoming/);
  await assert.rejects(submit({ type: 'Good Moral Certificate' }), /hardcopy only/);
  await asUser(staff);
  await db.query("insert into public.office_closures values ($1,'Holiday')", [day]);
  await asUser(residentA);
  await assert.rejects(submit(), /office is closed/);
  await asUser(staff);
  await db.query('delete from public.office_closures where closed_date = $1', [day]);
});

test('capacity, duplicate requests, and availability counts are enforced without exposing other residents', async () => {
  await asUser(staff);
  await db.query("update public.appointment_slots set capacity = 1 where label = '8:00 AM - 9:00 AM'");
  await asUser(residentA);
  const reference = await submit();
  await assert.rejects(submit({ slot: '9:00 AM - 10:00 AM' }), /active request/);
  await asUser(residentB);
  await assert.rejects(submit({ owner: residentB }), /slot is full/);
  assert.equal((await db.query('select * from public.appointment_requests')).rows.length, 0);
  const availability = await db.query('select * from public.get_slot_availability($1)', [day]);
  assert.equal(availability.rows.find(slot => slot.label === '8:00 AM - 9:00 AM').remaining, 0);
  await asUser(staff);
  await assert.rejects(db.query("update public.appointment_requests set status = 'REJECTED' where reference = $1", [reference]), /rejection reason/);
  await db.query("update public.appointment_requests set status = 'REJECTED', rejection_reason = 'Please supply proof of residency.' where reference = $1", [reference]);
  await asUser(residentA);
  const history = await db.query('select * from public.request_events where request_reference = $1 order by created_at', [reference]);
  assert.equal(history.rows.length, 2);
  assert.equal(history.rows[1].actor_name.trim(), 'Staff');
  assert.match(history.rows[1].description, /proof of residency/);
  const newReference = await submit();
  await assert.rejects(db.query("update public.appointment_requests set status = 'APPROVED' where reference = $1 returning *", [newReference]).then(result => { if (!result.rows.length) throw new Error('Not allowed by RLS'); }), /Not allowed/);
});

test('residents cannot edit staff settings or another resident certificate history', async () => {
  await asUser(residentB);
  const result = await db.query('update public.appointment_slots set capacity = 200 returning *');
  assert.equal(result.rows.length, 0);
  await assert.rejects(db.exec("insert into public.office_closures values ('2027-01-01','Unauthorized')"), /row-level security/);
  await assert.rejects(db.exec("insert into public.request_events(request_reference,actor_name,status,description) values ('fake','fake','COMPLETED','fake')"), /permission denied/);
  await assert.rejects(db.exec('select signing_secret from public.delivery_tracking_settings'), /permission denied/);
});

test('delivery events are deduplicated and do not regress delivered status', async () => {
  await db.exec('reset role');
  const reference = (await db.query("select reference from public.appointment_requests where status = 'PENDING' limit 1")).rows[0].reference;
  await db.query(`insert into public.certificate_deliveries(id,request_reference,owner_id,sent_by,sender_name,recipient_email,template_name,storage_path,pdf_hash,provider_id,status) values ('00000000-0000-4000-8000-000000000010',$1,$2,$3,'Staff','a@example.test','BARANGAY CLEARANCE.docx',$4,'hash','provider-1','sent')`, [reference, residentA, staff, `${residentA}/${reference}/certificate.pdf`]);
  await db.query("insert into storage.objects(bucket_id,name) values ('completed-certificates',$1)", [`${residentA}/${reference}/certificate.pdf`]);
  await asUser(residentA);
  assert.equal((await db.query('select * from public.certificate_deliveries')).rows.length, 1);
  assert.equal((await db.query("select * from storage.objects where bucket_id = 'completed-certificates'")).rows.length, 1);
  await asUser(residentB);
  assert.equal((await db.query('select * from public.certificate_deliveries')).rows.length, 0);
  assert.equal((await db.query("select * from storage.objects where bucket_id = 'completed-certificates'")).rows.length, 0);
  await assert.rejects(db.query("select public.apply_email_event('fake','provider-1','delivered',now())"), /permission denied/);
  await asUser(staff, 'service_role');
  await db.query("select public.apply_email_event('event-1','provider-1','delivered','2026-10-15T10:00:00Z')");
  await db.query("select public.apply_email_event('event-1','provider-1','failed','2026-10-15T11:00:00Z')");
  await db.query("select public.apply_email_event('event-2','provider-1','sent','2026-10-15T09:00:00Z')");
  assert.equal((await db.query("select status from public.certificate_deliveries where provider_id = 'provider-1'")).rows[0].status, 'delivered');
});
