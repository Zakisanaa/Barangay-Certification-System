import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function root(){await asUser('','service_role');await db.exec('reset role');}
async function rejected(work,pattern){await db.exec('savepoint denied');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint denied;release savepoint denied');}}
async function feed(page=0){return(await db.query('select public.resident_notification_feed($1) result',[page])).rows[0].result;}
async function booking(){await asUser(residentA);const reference='RESIDENT-NOTICE-BOOKING',path=await uploadBookingId(db,residentA,reference);return(await db.query("insert into appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path,id_review_acknowledged) values($1,$2,'Juan Dela Cruz','Barangay Lagasit','Passport: 123','Barangay Clearance','Employment',$3,'8:00 AM - 9:00 AM','Hardcopy',$4,true) returning *",[reference,residentA,day,path])).rows[0];}
async function notices(kind){return(await feed()).rows.filter(n=>n.kind===kind);}

test('request changes reach the resident bell even if email delivery fails, with no duplicate on retries',async()=>{
 const row=await booking();await asUser(staff);await db.query("select public.manage_appointment($1,'approve',$2)",[row.reference,row.version]);
 await asUser(residentA);const approved=(await notices('appointment_update')).find(n=>n.body.includes('APPROVED'));assert.ok(approved);assert.equal(approved.reference,row.reference);
 await root();const email=(await db.query("update notification_outbox set status='failed' where reference=$1 returning id,event_key",[row.reference])).rows[0];await db.query("update notification_outbox set status='pending' where id=$1",[email.id]);
 await asUser(residentA);assert.equal((await feed()).rows.filter(n=>n.id===approved.id).length,1);assert.equal((await feed()).rows.some(n=>'event_key'in n||'owner_id'in n),false);
});

test('public concern replies notify residents while internal staff notes stay private',async()=>{
 await asUser(residentA);await db.query("insert into resident_concerns(reference,owner_id,name,contact,category,message) values('CON-NOTICE',$1,'Juan Dela Cruz','09931411699','Feedback','Please review the queue')",[residentA]);
 await asUser(staff);await db.query("select public.send_concern_message('CON-NOTICE',gen_random_uuid(),'Internal confidential note',true)");await db.query("select public.send_concern_message('CON-NOTICE',gen_random_uuid(),'The office has reviewed your concern',false)");
 await asUser(residentA);const rows=await notices('concern_reply');assert.equal(rows.length,1);assert.match(rows[0].body,/reviewed your concern/);assert.ok(!(await feed()).rows.some(n=>n.body.includes('Internal confidential note')));
});

test('verification decisions and fee records are visible only to the affected resident',async()=>{
 const row=await booking();await asUser(staff);await db.query("select public.review_resident($1,'identity','verified','in_person','Valid ID checked',null)",[residentA]);await db.query("update office_settings set fee_tracking_enabled=true where id=1");await db.query("select public.manage_appointment($1,'approve',$2)",[row.reference,row.version]);
 const id=randomUUID(),args=[id,row.reference,null,100,'PAID','OR-NOTICE','Paid at office',null,'Cash at barangay office'];for(let n=0;n<2;n++)await db.query('select public.record_office_fee($1,$2,$3,$4,$5,$6,$7,$8,$9)',args);
 await asUser(residentA);assert.equal((await notices('verification')).length,1);assert.equal((await notices('fee_record')).length,1);assert.equal((await notices('fee_record'))[0].reference,row.reference);
 const own=(await feed()).rows[0];await asUser(residentB);assert.equal((await feed()).total,0);assert.equal((await db.query('select public.mark_resident_notifications_read($1) n',[[own.id]])).rows[0].n,0);
});

test('certificate PDF notifications wait for an available sent file and do not repeat on delivery updates',async()=>{
 const row=await booking(),id=randomUUID(),path=`${residentA}/${row.reference}/notice.pdf`;await root();await db.query("insert into certificate_deliveries(id,request_reference,owner_id,sent_by,sender_name,recipient_email,template_name,storage_path,pdf_hash) values($1,$2,$3,$4,'Staff','a@example.test','BARANGAY CLEARANCE.docx',$5,repeat('a',64))",[id,row.reference,residentA,staff,path]);
 await asUser(residentA);assert.equal((await notices('certificate_pdf')).length,0);await root();await db.query("insert into storage.objects(bucket_id,name) values('completed-certificates',$1)",[path]);await asUser(residentA);assert.equal((await notices('certificate_pdf')).length,0);
 await root();await db.query("update certificate_deliveries set status='sent',provider_id='notice-provider' where id=$1",[id]);await db.query("update certificate_deliveries set status='delivered' where id=$1",[id]);await asUser(residentA);assert.equal((await notices('certificate_pdf')).length,1);
});

test('resident notification pagination and read markers persist without changing another account',async()=>{
 for(let n=0;n<31;n++)await db.query("insert into resident_notifications(owner_id,kind,reference,title,body,event_key,created_at) values($1,'appointment_update',$2,$2,'Private update',$2,$3)",[residentA,'NOTICE-'+String(n).padStart(2,'0'),`2026-10-${String(n%28+1).padStart(2,'0')}T${String(Math.floor(n/28)).padStart(2,'0')}:00:00Z`]);
 await db.query("insert into resident_notifications(owner_id,kind,title,body,event_key) values($1,'verification','Other resident','Other private update','other-private')",[residentB]);
 await asUser(residentA);const first=await feed(),second=await feed(1);assert.equal(first.total,31);assert.equal(first.rows.length,25);assert.equal(second.rows.length,6);assert.equal(new Set([...first.rows,...second.rows].map(n=>n.id)).size,31);
 await db.query('select public.mark_resident_notifications_read($1)',[[first.rows[0].id]]);assert.equal((await feed()).unread,30);assert.equal((await feed()).rows[0].read,true);await db.query('select public.mark_resident_notifications_read(null)');assert.equal((await feed()).unread,0);
 await asUser(residentB);assert.equal((await feed()).unread,1);await rejected(()=>feed(-1),/valid notification page/);
});

test('notification content cannot be forged and residents, staff and anonymous readers stay isolated',async()=>{
 await booking();await asUser(residentA);await rejected(()=>db.query("insert into resident_notifications(owner_id,kind,title,body,event_key) values($1,'forged','Forged','Forged','fake')",[residentA]),/permission denied/);await rejected(()=>db.query("update resident_notifications set body='Forged'"),/permission denied/);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.create_resident_notification()','execute') allowed")).rows[0].allowed,false);
 await asUser(residentB);assert.equal((await db.query('select * from resident_notifications')).rows.length,0);
 await asUser(staff);await rejected(()=>feed(),/Resident sign-in/);assert.equal((await db.query('select * from resident_notifications')).rows.length,0);
 await asUser('','anon');await rejected(()=>feed(),/permission denied/);
});
