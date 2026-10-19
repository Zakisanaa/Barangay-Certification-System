import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';

let db,day,asUser,sequence=0;
before(async()=>{({db,day,asUser}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback; reset role');});
const rejected=async(work,pattern)=>{
  await db.exec('savepoint expected_failure');
  try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint expected_failure; release savepoint expected_failure');}
};
const request=async(overrides={})=>{
  const row={reference:`P1-${++sequence}`,owner:residentA,type:'Barangay Clearance',format:'Softcopy',id:"Voter's ID: 123",date:day,slot:'8:00 AM - 9:00 AM',...overrides};
  if(!Object.hasOwn(overrides,'image'))row.image=await uploadBookingId(db,row.owner,row.reference);
  return (await db.query(`insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path,id_review_acknowledged) values($1,$2,'Juan Dela Cruz','Barangay Lagasit',$3,$4,'Employment',$5,$6,$7,$8,true) returning *`,[row.reference,row.owner,row.id,row.type,row.date,row.slot,row.format,row.image])).rows[0];
};
const action=async(row,name,details={})=>(await db.query('select * from public.manage_appointment($1,$2,$3,$4,$5,$6,$7)',[row.reference,name,row.version,details.reason??null,details.date??null,details.slot??null,details.recipient??null])).rows[0];
const stored=async(row)=>(await db.query('select * from public.appointment_requests where reference=$1',[row.reference])).rows[0];
const seedPast=async(row,status='APPROVED')=>{
  await asUser('', 'service_role');
  await db.exec('reset role; set constraints all immediate; alter table public.appointment_requests disable trigger validate_appointment');
  try{await db.query("update public.appointment_requests set appointment_date=(now() at time zone 'Asia/Manila')::date-1,status=$2,reschedule_reason='Legacy record test setup' where reference=$1",[row.reference,status]);}
  finally{await db.exec('alter table public.appointment_requests enable trigger validate_appointment');}
  return stored(row);
};
const savePdf=async(row,withObject=true)=>{
  await db.exec('reset role');
  const path=`${row.owner_id}/${row.reference}/completed.pdf`;
  await db.query(`insert into public.certificate_deliveries(id,request_reference,owner_id,sent_by,sender_name,recipient_email,template_name,storage_path,pdf_hash,status)
    values(gen_random_uuid(),$1,$2,$3,'Test Staff','a@example.test','BARANGAY CLEARANCE.docx',$4,'verified-hash','sent')`,[row.reference,row.owner_id,staff,path]);
  if(withObject)await db.query("insert into storage.objects(bucket_id,name) values('completed-certificates',$1)",[path]);
};

test('resident cancellation is owned, versioned, recorded, and releases capacity',async()=>{
  await asUser(staff);await db.query("update public.appointment_slots set capacity=1 where label='8:00 AM - 9:00 AM'");
  await asUser(residentA);const row=await request();
  await asUser(staff);await rejected(()=>db.query('update public.appointment_requests set archived=true where reference=$1',[row.reference]),/Resolve or cancel/);await asUser(residentA);
  await rejected(()=>action(row,'cancel',{reason:' \t\r\n '}),/reason/);
  await rejected(()=>action(row,'approve'),/Only staff/);
  await asUser(residentB);await rejected(()=>action(row,'cancel',{reason:'Not mine'}),/access denied/);
  await asUser(residentA);const cancelled=await action(row,'cancel',{reason:'Unable to attend'});
  assert.equal(cancelled.status,'CANCELLED');assert.equal(cancelled.version,row.version+1);
  assert.equal((await db.query('select * from public.get_slot_availability($1)',[day])).rows[0].remaining,1);
  const history=(await db.query('select * from public.request_events where request_reference=$1',[row.reference])).rows;
  assert.ok(history.some(event=>event.status==='CANCELLED'&&event.description==='Unable to attend'));
  assert.equal((await db.query('select * from public.notification_outbox where reference=$1',[row.reference])).rows.length,2);
  assert.equal((await request()).status,'PENDING');
  await rejected(()=>action(cancelled,'cancel',{reason:'Again'}),/Only authorized|status transition|permission/);
});

test('staff rescheduling checks capacity, closures, reasons, stale versions, and records both schedules',async()=>{
  await asUser(residentA);const row=await request();
  await asUser(residentB);await request({owner:residentB,slot:'9:00 AM - 10:00 AM'});
  await asUser(staff);await db.query("update public.appointment_slots set capacity=1 where label='9:00 AM - 10:00 AM'");
  await rejected(()=>action(row,'reschedule',{date:day,slot:'9:00 AM - 10:00 AM',reason:'Office change'}),/slot is full/);
  await rejected(()=>action(row,'reschedule',{date:day,slot:'10:00 AM - 11:00 AM'}),/reason/);
  await db.query('insert into public.office_closures values($1,$2)',[day,'Office closed']);
  await rejected(()=>action(row,'reschedule',{date:day,slot:'10:00 AM - 11:00 AM',reason:'Office change'}),/closed/);
  await db.query('delete from public.office_closures where closed_date=$1',[day]);
  const moved=await action(row,'reschedule',{date:day,slot:'10:00 AM - 11:00 AM',reason:'Resident requested another time'});
  assert.equal(moved.time_slot,'10:00 AM - 11:00 AM');
  await rejected(()=>action(row,'approve'),/request changed/);
  const history=(await db.query('select description from public.request_events where request_reference=$1',[row.reference])).rows;
  assert.ok(history.some(event=>event.description.includes('8:00 AM - 9:00 AM')&&event.description.includes('10:00 AM - 11:00 AM')));
  await asUser(residentA);await rejected(()=>action(moved,'reschedule',{date:day,slot:'11:00 AM - 12:00 PM',reason:'Change'}),/Only staff/);
});

test('expiry releases stale requests, preserves issued documents, and old dates never block new booking',async()=>{
  await asUser(residentA);const old=await request();await seedPast(old,'PENDING');
  await asUser(residentA);assert.equal((await request()).status,'PENDING');
  await rejected(()=>db.query('select public.expire_overdue_appointments()'),/permission denied/);
  await asUser('', 'service_role');assert.equal((await db.query('select public.expire_overdue_appointments() as n')).rows[0].n,1);
  await asUser(staff);
  assert.equal((await stored(old)).status,'EXPIRED');
  await asUser(residentB);const issued=await request({owner:residentB});await seedPast(issued);await savePdf(issued);
  await asUser('', 'service_role');await db.query('select public.expire_overdue_appointments()');
  await asUser(staff);
  assert.equal((await stored(issued)).status,'APPROVED');
  await asUser(residentA);const approved=await request({type:'Certificate of Residency'});await seedPast(approved,'APPROVED');
  await asUser('', 'service_role');await db.query('select public.expire_overdue_appointments()');
  await asUser(staff);assert.equal((await stored(approved)).status,'APPROVED');
});

test('no-show requires staff, an ended appointment, no fulfillment, and a reason',async()=>{
  await asUser(residentA);let row=await request();await asUser(staff);row=await action(row,'approve');
  await rejected(()=>action(row,'no_show',{reason:'Did not arrive'}),/slot has ended/);
  row=await seedPast(row);await asUser(staff);
  const missed=await action(row,'no_show',{reason:'Attendance checked at the desk'});assert.equal(missed.status,'NO_SHOW');
  await asUser(residentA);assert.equal((await request()).status,'PENDING');
});

test('softcopy completion needs a real archived PDF and issued documents cannot be cancelled',async()=>{
  await asUser(residentA);let row=await request();await asUser(staff);row=await action(row,'approve');
  await rejected(()=>action(row,'complete'),/completed certificate PDF/);
  await savePdf(row,false);await asUser(staff);await rejected(()=>action(row,'complete'),/completed certificate PDF/);
  await db.exec('reset role');await db.query("insert into storage.objects(bucket_id,name) select 'completed-certificates',storage_path from public.certificate_deliveries where request_reference=$1",[row.reference]);
  await asUser(residentA);await rejected(()=>action(row,'cancel',{reason:'Cancel issued document'}),/already been issued/);
  await asUser(staff);assert.equal((await action(row,'complete')).status,'COMPLETED');
});

test('hardcopy and Both completion require collection, and Both also requires a real PDF',async()=>{
  for(const format of ['Hardcopy','Both']){
    await asUser(residentA);let row=await request({format,type:format==='Both'?'Certificate of Residency':'Barangay Clearance'});
    await asUser(staff);await rejected(()=>action(row,'collect',{recipient:'Juan Dela Cruz'}),/approved hardcopy/);
    row=await action(row,'approve');await rejected(()=>action(row,'complete'),format==='Both'?/completed certificate PDF/:/hardcopy collection/);
    await rejected(()=>action(row,'collect',{recipient:' '}),/recipient|hardcopy/);
    row=await action(row,'collect',{recipient:'Juan Dela Cruz'});assert.equal(row.hardcopy_collected_by,staff);assert.ok(row.hardcopy_collected_at);
    await rejected(()=>action(row,'collect',{recipient:'Someone else'}),/once/);
    if(format==='Both'){await rejected(()=>action(row,'complete'),/completed certificate PDF/);await savePdf(row);await asUser(staff);}
    assert.equal((await action(row,'complete')).status,'COMPLETED');
  }
});

test('School ID submission requires a real fresh owned upload, while unused uploads can be removed',async()=>{
  await asUser(residentA);const reference=`P1-SCHOOL-${++sequence}`,path=`${residentA}/${reference}/school-id.jpg`;
  await rejected(()=>request({reference,id:'School ID: 123',image:path}),/missing or expired/);
  await rejected(()=>request({id:'school id: 123',image:null}),/supported ID type/);
  await db.query("insert into storage.objects(bucket_id,name) values('resident-school-ids',$1)",[path]);
  assert.equal((await db.query("select name from storage.objects where name=$1",[path])).rows.length,1);
  await request({reference,id:'School ID: 123',image:path});
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,0);
  assert.equal((await db.query('select name from storage.objects where name=$1',[path])).rows.length,0);
  const unused=`${residentA}/UNSUBMITTED/school-id.png`;
  await db.query("insert into storage.objects(bucket_id,name) values('resident-school-ids',$1)",[unused]);
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[unused])).rows.length,1);
  await asUser(residentB);assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,0);
  await asUser(staff);assert.equal((await db.query('select name from storage.objects where name=$1',[path])).rows.length,1);
});

test('orphan maintenance excludes referenced uploads and is restricted to the service role',async()=>{
  await asUser(residentA);const reference=`P1-ORPHAN-${++sequence}`,used=`${residentA}/${reference}/school-id.jpg`,unused=`${residentA}/ORPHAN/school-id.jpg`;
  await db.query("insert into storage.objects(bucket_id,name) values('resident-school-ids',$1),('resident-school-ids',$2)",[used,unused]);
  await request({reference,id:'School ID: 123',image:used});
  await db.exec("reset role; update storage.objects set created_at=now()-interval '2 days'");
  await asUser(residentA);await rejected(()=>db.query('select * from public.orphan_school_id_paths()'),/permission denied/);
  await asUser('', 'service_role');assert.deepEqual((await db.query('select * from public.orphan_school_id_paths()')).rows,[{path:unused}]);
});

test('service matching normalizes known names before disabled-service and duplicate checks',async()=>{
  await asUser(staff);await db.query("update public.service_catalog set active=false where request_type='Barangay Clearance'");
  await asUser(residentA);for(const type of ['barangay clearance',' BARANGAY   CLEARANCE ','\tBARANGAY\tCLEARANCE\r\n'])await rejected(()=>request({type,format:'Hardcopy'}),/unavailable/);
  await asUser(staff);await db.query("update public.service_catalog set active=true where request_type='Barangay Clearance'");
  await asUser(residentA);assert.equal((await request({type:'\t BARANGAY\n  CLEARANCE \t'})).request_type,'Barangay Clearance');
  await rejected(()=>request({type:'barangay clearance'}),/active request/);
});

test('new concerns cannot forge status/archive/time and valid submissions retain their owner',async()=>{
  await asUser(residentA);
  const insert=(status,archived=false)=>db.query(`insert into public.resident_concerns(reference,owner_id,name,contact,category,message,status,archived,submitted_at)
    values('CON-P1',$1,'Juan Dela Cruz','09931411699','Feedback','A valid concern',$2,$3,'2099-01-01') returning *`,[residentA,status,archived]);
  await rejected(()=>insert('RESOLVED'),/must start as Received/);await rejected(()=>insert('RECEIVED',true),/cannot be archived/);
  const concern=(await insert('RECEIVED')).rows[0];assert.equal(concern.owner_id,residentA);assert.ok(new Date(concern.submitted_at)<new Date('2099-01-01'));
  await asUser(staff);await db.query("update public.resident_concerns set status='IN_REVIEW' where reference='CON-P1'");
  const queue=(await db.query("select * from public.notification_outbox where reference='CON-P1'")).rows;assert.equal(queue.length,1);assert.match(queue[0].body,/IN REVIEW/);
});

test('profile edits and auth-triggered registration reject invalid data and normalize valid phone numbers',async()=>{
  await asUser(residentA);
  for(const [field,value] of [['first_name',' \t\n '],['last_name',''],['contact_number','invalid'],['address','\r\n']]){
    await rejected(()=>db.query(`update public.resident_profiles set ${field}=$1 where id=$2`,[value,residentA]),/Enter a/);
  }
  const normalized=(await db.query("update public.resident_profiles set contact_number=' +63 (917) 123-4567 ' where id=$1 returning contact_number",[residentA])).rows[0];
  assert.equal(normalized.contact_number,'+639171234567');
  await db.exec('reset role');
  await rejected(()=>db.query("insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'invalid@example.test','{}')"),/Enter a/);
  assert.equal((await db.query("select count(*)::integer as n from auth.users where email='invalid@example.test'")).rows[0].n,0);
});

test('status changes and staff replies enqueue once, and residents cannot forge queue jobs',async()=>{
  await asUser(residentA);let row=await request();
  assert.equal((await db.query('select * from public.notification_outbox where reference=$1',[row.reference])).rows.length,1);
  await rejected(()=>db.query("insert into public.notification_outbox(event_key,owner_id,reference,kind,recipient_email,subject,body) values('forged',$1,'fake','fake','someone@example.test','Fake','Fake')",[residentA]),/permission denied/);
  await rejected(()=>db.query('select public.notification_worker_access()'),/permission denied/);
  await asUser(staff);row=await action(row,'approve');
  await db.query('update public.appointment_requests set status=status where reference=$1',[row.reference]);
  await db.query("insert into public.transaction_messages(request_reference,author_id,author_name,author_role,body) values($1,$2,'Test Staff','Staff','Please bring the original ID.')",[row.reference,staff]);
  const jobs=(await db.query('select * from public.notification_outbox where reference=$1',[row.reference])).rows;
  assert.equal(jobs.length,3);assert.ok(jobs.every(job=>job.recipient_email==='a@example.test'));assert.ok(jobs.some(job=>job.kind==='staff_reply'));
  await asUser(residentB);assert.equal((await db.query('select * from public.notification_outbox')).rows.length,0);
});

test('a failed outbox insert rolls back the status and request history together',async()=>{
  await asUser(residentA);const row=await request();
  await db.exec("reset role; alter table public.notification_outbox add constraint test_reject_approval check(body not like '%Status: APPROVED%')");
  await asUser(staff);await rejected(()=>action(row,'approve'),/test_reject_approval/);
  assert.equal((await stored(row)).status,'PENDING');assert.equal((await db.query('select * from public.request_events where request_reference=$1',[row.reference])).rows.length,1);
});

test('scheduled maintenance keeps credentials server-only, validates its destination, and configures idempotently',async()=>{
  await db.exec(`reset role;
    create schema vault;
    create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text);
    create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(new_secret text,new_name text,new_description text) returns uuid language sql as $$
      insert into vault.secrets(name,secret) values(new_name,new_secret) returning id $$;
    create function vault.update_secret(secret_id uuid,new_secret text) returns void language sql as $$
      update vault.secrets set secret=new_secret where id=secret_id $$;
    create schema net;
    create table net.requests(id bigint generated always as identity,url text,headers jsonb,body jsonb,timeout_milliseconds integer);
    create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$
      insert into net.requests(url,headers,body,timeout_milliseconds) values(url,headers,body,timeout_milliseconds) returning id $$;
  `);
  await asUser(residentA);
  const origin='https://exampleproject.supabase.co',key='test-only-not-a-real-key-'.repeat(6);
  await rejected(()=>db.query('select public.configure_barangay_maintenance($1,$2)',[origin,key]),/permission denied/);
  await rejected(()=>db.query('select public.invoke_barangay_maintenance()'),/permission denied/);
  await asUser('', 'service_role');
  await rejected(()=>db.query('select public.invoke_barangay_maintenance()'),/Configure barangay_project_url/);
  await rejected(()=>db.query('select public.configure_barangay_maintenance($1,$2)',['https://untrusted.example',key]),/linked Supabase origin/);
  for(let attempt=0;attempt<2;attempt++)assert.equal((await db.query('select public.configure_barangay_maintenance($1,$2) as ok',[origin+'/',key])).rows[0].ok,true);
  assert.equal((await db.query('select public.invoke_barangay_maintenance() as id')).rows[0].id,1);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::integer as n from vault.secrets')).rows[0].n,2);
  const invoked=(await db.query('select * from net.requests')).rows[0];
  assert.equal(invoked.url,origin+'/functions/v1/process-notifications');
  assert.equal(invoked.headers.Authorization,'Bearer '+key);assert.equal(invoked.headers.apikey,key);
  assert.deepEqual(invoked.body,{});assert.equal(invoked.timeout_milliseconds,55000);
});

test('notification claims are exclusive, use frozen payloads, and reject stale leases',async()=>{
  await asUser(residentA);await request();await asUser('', 'service_role');
  const first=(await db.query("select * from public.claim_notifications('Office <first@example.test>',5)")).rows[0];
  assert.equal((await db.query("select * from public.claim_notifications('Other <second@example.test>',5)")).rows.length,0);
  assert.equal((await db.query('select public.finish_notification($1,$2,null,$3) as ok',[first.id,first.lease_token,'Temporary network failure'])).rows[0].ok,true);
  assert.equal((await db.query('select status from public.notification_outbox where id=$1',[first.id])).rows[0].status,'retry');
  await db.query("update public.notification_outbox set next_attempt_at=now()-interval '1 second' where id=$1",[first.id]);
  const next=(await db.query("select * from public.claim_notifications('Other <second@example.test>',5)")).rows[0];
  assert.deepEqual(next.send_payload,first.send_payload);assert.notEqual(next.lease_token,first.lease_token);
  assert.equal((await db.query("select public.finish_notification($1,$2,'wrong',null) as ok",[first.id,first.lease_token])).rows[0].ok,false);
  assert.equal((await db.query("select public.finish_notification($1,$2,'provider-1',null) as ok",[next.id,next.lease_token])).rows[0].ok,true);
  assert.equal((await db.query('select status from public.notification_outbox where id=$1',[first.id])).rows[0].status,'sent');
  await asUser(staff);await rejected(()=>db.query('select public.retry_notification($1)',[first.id]),/cannot be safely/);
});

test('abandoned notification claims recover, bounded retries stay visible, and unsafe late sends require review',async()=>{
  await asUser(residentA);await request();await asUser('', 'service_role');
  const job=(await db.query("select * from public.claim_notifications('Office <sender@example.test>',5)")).rows[0];
  await db.query("update public.notification_outbox set claimed_at=now()-interval '6 minutes' where id=$1",[job.id]);
  const recovered=(await db.query("select * from public.claim_notifications('Office <sender@example.test>',5)")).rows[0];assert.equal(recovered.id,job.id);
  await db.query('update public.notification_outbox set attempts=6 where id=$1',[job.id]);
  await db.query('select public.finish_notification($1,$2,null,$3)',[job.id,recovered.lease_token,'Provider unavailable']);
  assert.equal((await db.query('select status from public.notification_outbox where id=$1',[job.id])).rows[0].status,'failed');
  await asUser(residentA);await rejected(()=>db.query('select public.retry_notification($1)',[job.id]),/Only staff/);
  await asUser(staff);await db.query('select public.retry_notification($1)',[job.id]);
  await asUser('', 'service_role');await db.query("update public.notification_outbox set first_attempt_at=now()-interval '24 hours' where id=$1",[job.id]);
  assert.equal((await db.query("select * from public.claim_notifications('Office <sender@example.test>',5)")).rows.length,0);
  assert.equal((await db.query('select status from public.notification_outbox where id=$1',[job.id])).rows[0].status,'needs_review');
});
