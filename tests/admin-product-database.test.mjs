import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, residentA, residentB, staff, uploadBookingId } from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback; reset role');});
async function rejected(work,pattern){await db.exec('savepoint expected_failure');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint expected_failure; release savepoint expected_failure');}}
async function concern(){await asUser(residentA);return(await db.query("insert into public.resident_concerns(reference,owner_id,name,contact,category,message) values('CON-TEST',$1,'Juan Dela Cruz','09931411699','Feedback','Please review this concern') returning *",[residentA])).rows[0];}
let requestSequence=0;
async function appointment(owner=residentA){await asUser(owner);const reference=`ADMIN-${++requestSequence}`,image=await uploadBookingId(db,owner,reference);return(await db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path,id_review_acknowledged) values($1,$2,'Juan Dela Cruz','Barangay Lagasit','Voter''s ID: 123','Barangay Clearance','Employment',$3,'8:00 AM - 9:00 AM','Hardcopy',$4,true) returning *",[reference,owner,day,image])).rows[0];}
async function approve(row){await asUser(staff);return(await db.query("select * from public.manage_appointment($1,'approve',$2)",[row.reference,row.version])).rows[0];}

test('resident verification records method, evidence, reviewer, conflicts, and ownership',async()=>{
 await asUser(staff);
 await rejected(()=>db.query("select * from public.review_resident($1,'identity','verified',null,'Checked documents',null)",[residentA]),/how.*verified/);
 await rejected(()=>db.query("select * from public.review_resident($1,'identity','verified','uploaded_evidence','Checked documents',null)",[residentA]),/No uploaded evidence/);
 await asUser(residentA);const path=`${residentA}/identity/proof.pdf`;
 await rejected(()=>db.query("insert into public.resident_evidence(resident_id,kind,label,storage_path) values($1,'identity','Proof',$2)",[residentA,path]),/Upload.*before saving/);
 await db.query("insert into storage.objects(bucket_id,name) values('resident-evidence',$1)",[path]);
 await db.query("insert into public.resident_evidence(resident_id,kind,label,storage_path) values($1,'identity','Proof',$2)",[residentA,path]);
 await asUser(staff);const review=(await db.query("select * from public.review_resident($1,'identity','verified','uploaded_evidence','Compared submitted evidence with the resident record',null)",[residentA])).rows[0];
 assert.equal(review.reviewed_by,staff);assert.ok(review.reviewed_at);
 await rejected(()=>db.query("select * from public.review_resident($1,'identity','rejected','uploaded_evidence','Stale update',0)",[residentA]),/changed/);
 await asUser(residentA);assert.equal((await db.query('select * from public.resident_verifications')).rows.length,1);
 await asUser(residentB);assert.equal((await db.query('select * from public.resident_verifications')).rows.length,0);
 await rejected(()=>db.query("select * from public.review_resident($1,'residency','verified','in_person','Not authorized',null)",[residentB]),/permission/);
});

test('required documents are transactional, private, reviewable, and replaceable only after a correction request',async()=>{
 await asUser(staff);const requirement=(await db.query("select * from public.save_service_requirement(gen_random_uuid(),'Barangay Clearance','Supporting proof','Office-approved instructions',true,true,null)")).rows[0];
 const reference='ADMIN-DOCS';const payload={reference,full_name:'Juan Dela Cruz',address:'Barangay Lagasit',id_review_acknowledged:true,voter_id:"Voter's ID: 123",request_type:'Barangay Clearance',purpose:'Employment',appointment_date:day,time_slot:'8:00 AM - 9:00 AM',delivery_format:'Hardcopy'};
 await asUser(residentA);
 payload.school_id_image_path=await uploadBookingId(db,residentA,reference);
 await rejected(()=>db.query('select * from public.submit_document_request($1,$2)',[JSON.stringify(payload),'[]']),/Upload all required/);
 assert.equal((await db.query('select * from public.appointment_requests')).rows.length,0);
 assert.equal((await db.query('select * from public.notification_outbox')).rows.length,0);
 const path=`${residentA}/${reference}/proof.pdf`,id='22222222-2222-4222-8222-222222222222';
 const attachments=JSON.stringify([{id,requirement_id:requirement.id,storage_path:path}]);
 await rejected(()=>db.query('select * from public.submit_document_request($1,$2)',[JSON.stringify(payload),attachments]),/missing or belongs/);
 await db.query("insert into storage.objects(bucket_id,name) values('request-attachments',$1)",[path]);
 let row=(await db.query('select * from public.submit_document_request($1,$2)',[JSON.stringify(payload),attachments])).rows[0];
 assert.equal(row.owner_id,residentA);assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,0);
 await asUser(staff);await rejected(()=>db.query("select * from public.manage_appointment($1,'approve',$2)",[reference,row.version]),/accept all required/);
 let reviewed=(await db.query("select * from public.review_request_attachment($1,1,'REPLACEMENT_REQUESTED','Upload the complete page')",[id])).rows[0];
 await asUser(residentB);await rejected(()=>db.query('select * from public.replace_request_attachment($1,$2,gen_random_uuid(),$3)',[id,reviewed.version,path]),/Only the owner/);
 await asUser(residentA);const replacement=`${residentA}/${reference}/replacement.pdf`;await db.query("insert into storage.objects(bucket_id,name) values('request-attachments',$1)",[replacement]);
 const updated=(await db.query('select * from public.replace_request_attachment($1,$2,gen_random_uuid(),$3)',[id,reviewed.version,replacement])).rows[0];
 await asUser(staff);await db.query("select * from public.review_request_attachment($1,1,'ACCEPTED','Complete document reviewed')",[updated.id]);
 row=await approve(row);assert.equal(row.status,'APPROVED');
 assert.equal((await db.query("select count(*)::int n from public.request_attachments where status='REPLACED'")).rows[0].n,1);
 await db.query("select * from public.manage_appointment($1,'cancel',$2,'Resident cannot attend')",[reference,row.version]);
 await rejected(()=>db.query("select * from public.review_request_attachment($1,2,'REPLACEMENT_REQUESTED','Another copy')",[updated.id]),/request is active/);
});

test('office queue, staff assignment, check-in, and idempotent walk-in handling require permission',async()=>{
 let row=await appointment();row=await approve(row);
 await asUser(residentA);await rejected(()=>db.query('select * from public.manage_queue_entry($1,$2,null,true)',[row.reference,row.version]),/permission/);
 await asUser(staff);await rejected(()=>db.query('select * from public.manage_queue_entry($1,$2,$3,false)',[row.reference,row.version,residentB]),/active staff/);
 row=(await db.query('select * from public.manage_queue_entry($1,$2,$3,false)',[row.reference,row.version,staff])).rows[0];
 row=(await db.query('select * from public.manage_queue_entry($1,$2,null,true)',[row.reference,row.version])).rows[0];assert.equal(row.checked_in_by,staff);assert.ok(row.checked_in_at);
 await rejected(()=>db.query('select * from public.manage_queue_entry($1,$2,null,true)',[row.reference,row.version]),/once/);
 const id='33333333-3333-4333-8333-333333333333';let walkin;
 for(let attempt=0;attempt<2;attempt++)walkin=(await db.query("select * from public.save_walk_in($1,'Walk-in resident','','Barangay Clearance','Employment','WAITING',$2,null,null)",[id,staff])).rows[0];
 assert.equal((await db.query('select count(*)::int n from public.walk_in_transactions')).rows[0].n,1);
 walkin=(await db.query("select * from public.save_walk_in($1,$2,'','Barangay Clearance','Employment','COMPLETED',$3,'Document handed over',$4)",[id,walkin.full_name,staff,walkin.version])).rows[0];assert.equal(walkin.status,'COMPLETED');
 await rejected(()=>db.query("select * from public.save_walk_in($1,$2,'','Barangay Clearance','Employment','WAITING',$3,null,$4)",[id,walkin.full_name,staff,walkin.version]),/cannot be rewritten/);
});

test('certificate register preserves replacement chains, revocation reasons, and resident access',async()=>{
 let row=await appointment();await asUser(staff);const first='44444444-4444-4444-8444-444444444444';
 await rejected(()=>db.query("select * from public.issue_certificate($1,$2,null,'Authorized signatory',null,null,null)",[first,row.reference]),/approved or completed/);
 row=await approve(row);const issued=(await db.query("select * from public.issue_certificate($1,$2,null,'Authorized signatory','OFFICIAL-1',null,null)",[first,row.reference])).rows[0];
 await rejected(()=>db.query("select * from public.issue_certificate($1,$2,null,'Different signatory','OFFICIAL-1',null,null)",[first,row.reference]),/identifier.*in use/);
 const replacement=(await db.query("select * from public.issue_certificate(gen_random_uuid(),$1,null,'Authorized signatory','OFFICIAL-2',$2,'Corrected document')",[row.reference,issued.id])).rows[0];
 assert.equal((await db.query('select status from public.certificate_register where id=$1',[issued.id])).rows[0].status,'SUPERSEDED');
 await rejected(()=>db.query('select * from public.revoke_certificate($1,$2,$3)',[replacement.id,replacement.version,' ']),/reason/);
 const revoked=(await db.query('select * from public.revoke_certificate($1,$2,$3)',[replacement.id,replacement.version,'Issuance corrected by authorized staff'])).rows[0];assert.equal(revoked.status,'REVOKED');
 await asUser(residentA);assert.equal((await db.query('select * from public.certificate_register')).rows.length,2);
 await asUser(residentB);assert.equal((await db.query('select * from public.certificate_register')).rows.length,0);
});

test('fee records are optional, receipt-based, immutable, and cannot be corrected twice',async()=>{
 const row=await appointment();await asUser(staff);const id='55555555-5555-4555-8555-555555555555';
 await rejected(()=>db.query("select * from public.record_fee($1,$2,null,100,'PAID','OR-1','Office payment',null)",[id,row.reference]),/enabled/);
 await db.query('update public.office_settings set fee_tracking_enabled=true where id=1');
 await rejected(()=>db.query("select * from public.record_fee($1,$2,null,100,'PAID',null,'Office payment',null)",[id,row.reference]),/receipt reference/);
 const payment=(await db.query("select * from public.record_fee($1,$2,null,100,'PAID','OR-1','Office payment',null)",[id,row.reference])).rows[0];
 await rejected(()=>db.query("select * from public.record_fee($1,$2,null,100,'PAID','OR-2','Office payment',null)",[id,row.reference]),/identifier.*in use/);
 await rejected(()=>db.query("select * from public.record_fee(gen_random_uuid(),$1,null,100,'PAID','OR-3','Wrong correction',$2)",[row.reference,payment.id]),/only when recording/);
 await db.query("select * from public.record_fee(gen_random_uuid(),$1,null,100,'REFUNDED',null,'Refund recorded against receipt',$2)",[row.reference,payment.id]);
 await rejected(()=>db.query("select * from public.record_fee(gen_random_uuid(),$1,null,100,'VOIDED',null,'Duplicate correction',$2)",[row.reference,payment.id]),/already recorded/);
 assert.equal((await db.query('select count(*)::int n from public.fee_records')).rows[0].n,2);
 await asUser(residentA);assert.equal((await db.query('select count(*)::int n from public.fee_records')).rows[0].n,2);
 await rejected(()=>db.query("update public.fee_records set amount=0"),/permission denied/);
});

test('capacity changes expose affected reservations and require an explicit acknowledgement',async()=>{
 await appointment(residentA);await appointment(residentB);await asUser(staff);
 const impacted=(await db.query("select public.affected_appointments($1,'8:00 AM - 9:00 AM') as result",[day])).rows[0].result;assert.equal(impacted.total,2);
 await rejected(()=>db.query("update public.appointment_slots set capacity=1 where label='8:00 AM - 9:00 AM'"),/acknowledge/);
 await rejected(()=>db.query("select * from public.save_operating_slot('8:00 AM - 9:00 AM','08:00','09:00',1,true,false)"),/Review affected/);
 await db.query("select * from public.save_operating_slot('8:00 AM - 9:00 AM','08:00','09:00',1,true,true)");
 assert.equal((await db.query("select count(*)::int n from public.appointment_requests where status='PENDING'")).rows[0].n,2);
});

test('reports, inbox read tracking, and public content respect permissions and concurrency',async()=>{
 await appointment();await concern();await asUser(staff);
 const report=(await db.query("select public.get_operational_report('requests',(now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date,0,1) as result")).rows[0].result;assert.equal(report.total,1);assert.equal(report.rows.length,1);
 const inbox=(await db.query('select public.staff_inbox(0,true) as result')).rows[0].result;assert.ok(inbox.unread>=2);
 await db.query('select public.mark_staff_notifications_read($1)',[[inbox.rows[0].id]]);
 assert.equal((await db.query('select public.staff_inbox(0,true) as result')).rows[0].result.unread,inbox.unread-1);
 const content=(await db.query("select * from public.save_site_content('mission','\"Verified office mission\"',null)")).rows[0];
 await rejected(()=>db.query("select * from public.save_site_content('mission','\"Stale change\"',0)"),/changed/);
 await asUser(residentA);assert.equal((await db.query("select value from public.site_content where key='mission'")).rows[0].value,'Verified office mission');
 await rejected(()=>db.query('select public.staff_inbox(0,false)'),/Staff sign-in/);
 await rejected(()=>db.query("select * from public.save_site_content('mission','\"Unauthorized\"',$1)",[content.version]),/permission/);
});

test('concerns keep original submissions, resolution history, private notes, and idempotent replies',async()=>{
 const c=await concern();await asUser(staff);
 await rejected(()=>db.query("update public.resident_concerns set message='Rewritten' where reference=$1",[c.reference]),/cannot be rewritten/);
 await rejected(()=>db.query("select * from public.manage_concern($1,$2,'RESOLVED',null,null)",[c.reference,c.version]),/Explain how/);
 const resolved=(await db.query("select * from public.manage_concern($1,$2,'RESOLVED','Staff contacted the resident and fixed the issue.',null)",[c.reference,c.version])).rows[0];
 assert.equal(resolved.status,'RESOLVED');
 await rejected(()=>db.query("select * from public.manage_concern($1,$2,'IN_REVIEW','Follow-up requested',null)",[c.reference,c.version]),/changed/);
 await db.query("select * from public.manage_concern($1,$2,'IN_REVIEW','Resident requested a follow-up',null)",[c.reference,resolved.version]);
 const id='11111111-1111-4111-8111-111111111111';
 for(let attempt=0;attempt<2;attempt++)await db.query('select * from public.send_concern_message($1,$2,$3,false)',[c.reference,id,'We will check this today.']);
 await db.query("select * from public.send_concern_message($1,gen_random_uuid(),'Private internal note',true)",[c.reference]);
 assert.equal((await db.query('select count(*)::int as n from public.concern_messages')).rows[0].n,2);
 assert.equal((await db.query("select count(*)::int as n from public.notification_outbox where kind='concern_reply'")).rows[0].n,1);
 await asUser(residentA);
 assert.equal((await db.query('select count(*)::int as n from public.concern_messages')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int as n from public.concern_events')).rows[0].n,2);
 await rejected(()=>db.query("select * from public.send_concern_message($1,gen_random_uuid(),'Resident internal',true)",[c.reference]),/access denied/);
 await asUser(residentB);assert.equal((await db.query('select * from public.concern_messages')).rows.length,0);
 await rejected(()=>db.query("select * from public.send_concern_message($1,gen_random_uuid(),'Not mine',false)",[c.reference]),/access denied/);
});

test('permissions, administrator self-protection, and audit history are enforced on the server',async()=>{
 await asUser(residentA);await rejected(()=>db.query("select * from public.set_staff_access($1,null,true,true,'{}')",[residentA]),/Superadmin/);
 await asUser(staff);await rejected(()=>db.query("select * from public.set_staff_access($1,1,false,false,'{}')",[staff]),/another superadmin/);
 await db.query("select * from public.set_staff_access($1,null,true,false,array['concerns'])",[residentB]);
 await asUser(residentB);
 assert.equal((await db.query("select public.has_staff_permission('concerns') as allowed")).rows[0].allowed,true);
 assert.equal((await db.query("select public.has_staff_permission('settings') as allowed")).rows[0].allowed,false);
 await rejected(()=>db.query("update public.office_settings set office_hours='Forged hours'"),/permission/);
 assert.equal((await db.query('select * from public.audit_log')).rows.length,0);
 await asUser(staff);assert.ok((await db.query("select * from public.audit_log where entity='staff_access'")).rows.length);
});

test('service creation, template versions, private file retention, and configured weekend bookings work together',async()=>{
 await asUser(staff);
 const service=(await db.query("select * from public.create_document_service('  Local   Certificate  ','Bring office-approved proof','','One office visit')")).rows[0];assert.equal(service.request_type,'Local Certificate');assert.equal(service.softcopy_available,false);
 await rejected(()=>db.query("select * from public.create_document_service('LOCAL CERTIFICATE','','','')"),/already exists/);
 await rejected(()=>db.query("select * from public.publish_certificate_template('Local Certificate','Main certificate','versions/missing.docx',0)"),/Upload the DOCX/);
 await db.query("insert into storage.objects(bucket_id,name) values('certificate-templates','versions/one.docx'),('certificate-templates','versions/two.docx')");
 const first=(await db.query("select * from public.publish_certificate_template('Local Certificate','Main certificate','versions/one.docx',0)")).rows[0];
 await rejected(()=>db.query("select * from public.publish_certificate_template('Local Certificate','Main certificate','versions/two.docx',0)"),/newer template/);
 const second=(await db.query("select * from public.publish_certificate_template('Local Certificate','Main certificate','versions/two.docx',1)")).rows[0];assert.equal(second.version,2);
 assert.equal((await db.query('select active from public.certificate_templates where id=$1',[first.id])).rows[0].active,false);
 assert.equal((await db.query("delete from storage.objects where name='versions/one.docx' returning name")).rows.length,0);
 const saturday=(await db.query("select d::date::text as day from generate_series((now() at time zone 'Asia/Manila')::date+1,(now() at time zone 'Asia/Manila')::date+7,'1 day') d where extract(isodow from d)=6 limit 1")).rows[0].day;
 await asUser(residentA);const payload={reference:'ADMIN-SAT',full_name:'Juan Dela Cruz',address:'Barangay Lagasit',id_review_acknowledged:true,voter_id:"Voter's ID: 123",request_type:'Local Certificate',purpose:'Office application',appointment_date:saturday,time_slot:'8:00 AM - 9:00 AM',delivery_format:'Hardcopy',school_id_image_path:await uploadBookingId(db,residentA,'ADMIN-SAT')};
 await rejected(()=>db.query("select * from public.submit_document_request($1,'[]')",[JSON.stringify(payload)]),/weekday|closed/i);
 await asUser(staff);await db.query('select public.save_office_weekday(6,true,false)');
 await asUser(residentA);const booked=(await db.query("select * from public.submit_document_request($1,'[]')",[JSON.stringify(payload)])).rows[0];assert.equal(booked.status,'PENDING');assert.equal(booked.service_key,'Local Certificate');
});

test('registered certificates must be revoked before cancelling their source transaction',async()=>{
 const row=await approve(await appointment());await asUser(staff);
 const issued=(await db.query("select * from public.issue_certificate(gen_random_uuid(),$1,null,'Barangay Captain')",[row.reference])).rows[0];
 await rejected(()=>db.query("select * from public.manage_appointment($1,'cancel',$2,'Resident cannot attend')",[row.reference,row.version]),/Revoke the issued certificate/);
 await db.query("select * from public.revoke_certificate($1,$2,'Voided before fulfillment')",[issued.id,issued.version]);
 const closed=(await db.query("select * from public.manage_appointment($1,'cancel',$2,'Resident cannot attend')",[row.reference,row.version])).rows[0];assert.equal(closed.status,'CANCELLED');
});

test('workload pagination reports the full total and counts actual walk-in work',async()=>{
 const row=await appointment();await asUser(staff);
 await db.query("select * from public.save_walk_in(gen_random_uuid(),'Walk-in Resident','','Barangay Clearance','Office visit','WAITING',$1)",[staff]);
 const date=(await db.query("select (now() at time zone 'Asia/Manila')::date::text as day")).rows[0].day;
 const first=(await db.query("select public.get_operational_report('workload',$1,$1,0,1) result",[date])).rows[0].result;
 const second=(await db.query("select public.get_operational_report('workload',$1,$1,1,1) result",[date])).rows[0].result;
 assert.equal(first.total,2);assert.equal(second.total,2);assert.equal(first.rows.length,1);assert.equal(second.rows.length,1);assert.notEqual(first.rows[0].staff,second.rows[0].staff);assert.equal([...first.rows,...second.rows].reduce((n,r)=>n+r.walk_ins,0),1);
});

test('initial superadmin setup is service-only, verifies the exact email, and cannot replace an existing administrator',async()=>{
 await asUser(residentA);await rejected(()=>db.query("select public.bootstrap_superadmin('a@example.test')"),/permission denied/);
 await asUser(staff,'service_role');await rejected(()=>db.query("select public.bootstrap_superadmin('a@example.test')"),/different superadmin/);
 await db.query('update public.staff_access set superadmin=false where user_id=$1',[staff]);
 await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[residentA]);await asUser(staff,'service_role');
 await rejected(()=>db.query("select public.bootstrap_superadmin('a@example.test')"),/email-confirmed/);
 await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=now() where id=$1',[residentA]);await asUser(staff,'service_role');
 assert.equal((await db.query("select public.bootstrap_superadmin('a@example.test') ok")).rows[0].ok,true);
 await asUser(residentA);assert.equal((await db.query('select public.is_superadmin() ok')).rows[0].ok,true);
 await db.query("select * from public.set_staff_access($1,1,false,false,array['requests'])",[staff]);
 await asUser(staff);assert.equal((await db.query('select public.is_barangay_staff() ok')).rows[0].ok,false);
 await rejected(()=>db.query("select public.create_document_service('Deactivated cannot create','','','')"),/permission/);
});

test('request conversations derive sender identity, role, and time from the authenticated account',async()=>{
 const row=await appointment();await asUser(residentA);
 const message=(await db.query("insert into public.transaction_messages(id,request_reference,author_id,author_name,author_role,body,sent_at) values(gen_random_uuid(),$1,$2,'Forged office name','Staff','Please review my request','2099-01-01') returning *",[row.reference,residentA])).rows[0];
 assert.equal(message.author_name,'Juan Dela Cruz');assert.equal(message.author_role,'Resident');assert.ok(Date.parse(message.sent_at)<Date.now()+60000);
});

