import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function rejected(work,pattern){await db.exec('savepoint denied');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint denied;release savepoint denied');}}
async function inbox(options={}){return(await db.query('select public.staff_inbox($1,$2,$3,$4,$5) result',[options.page??0,options.unread??false,options.query??'',options.sort??'newest',options.feature??''])).rows[0].result;}
async function events(kind){return(await db.query('select * from staff_notifications where kind=$1 order by created_at,id',[kind])).rows;}
async function root(){await asUser('','service_role');await db.exec('reset role');}
async function booking(reference='INBOX-BOOKING',attachments=[]){await asUser(residentA);const image=await uploadBookingId(db,residentA,reference);const payload={reference,full_name:'Juan Dela Cruz',address:'Barangay Lagasit',voter_id:'Passport: INBOX-123',request_type:'Barangay Clearance',purpose:'Employment',appointment_date:day,time_slot:'8:00 AM - 9:00 AM',delivery_format:'Hardcopy',school_id_image_path:image,id_review_acknowledged:true};return(await db.query('select * from public.submit_document_request($1,$2)',[JSON.stringify(payload),JSON.stringify(attachments)])).rows[0];}

test('resident account, profile and evidence activity reaches the residents inbox without notifying for no-op writes',async()=>{
 const id=randomUUID();await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'inbox-resident@example.test','{\"first_name\":\"Inbox\",\"last_name\":\"Resident\",\"contact_number\":\"09931411699\",\"address\":\"Barangay Lagasit\"}')",[id]);
 await asUser(staff);assert.ok((await events('resident_account')).some(n=>n.reference===id));
 await asUser(residentA);await db.query("update resident_profiles set contact_number='09931411698' where id=$1",[residentA]);
 const path=`${residentA}/identity/inbox.pdf`;await db.query("insert into storage.objects(bucket_id,name) values('resident-evidence',$1)",[path]);await db.query("insert into resident_evidence(resident_id,kind,label,storage_path) values($1,'identity','Identity proof',$2)",[residentA,path]);
 await asUser(staff);assert.equal((await events('resident_profile')).length,1);assert.equal((await events('verification_evidence')).length,1);
 await asUser(residentA);await db.query('update resident_profiles set contact_number=contact_number where id=$1',[residentA]);await asUser(staff);assert.equal((await events('resident_profile')).length,1);
 assert.ok((await inbox({feature:'residents',query:'Identity proof'})).rows.every(n=>n.permission==='residents'));
});

test('supporting uploads and replacements notify once, and a failed submission leaves no phantom notification',async()=>{
 await asUser(staff);const requirement=(await db.query("select * from public.save_service_requirement(gen_random_uuid(),'Barangay Clearance','Inbox proof','Complete page',true,true,null)")).rows[0];
 await rejected(()=>booking(),/Upload all required/);await asUser(staff);assert.equal((await events('document_upload')).length,0);
 await asUser(residentA);const path=`${residentA}/INBOX-UPLOAD/proof.pdf`;await db.query("insert into storage.objects(bucket_id,name) values('request-attachments',$1)",[path]);const id=randomUUID();await booking('INBOX-UPLOAD',[{id,requirement_id:requirement.id,storage_path:path}]);
 await asUser(staff);assert.equal((await events('document_upload')).length,1);await db.query("select public.review_request_attachment($1,1,'REPLACEMENT_REQUESTED','Upload every page')",[id]);
 await asUser(residentA);const next=`${residentA}/INBOX-UPLOAD/replacement.pdf`,replacement=randomUUID();await db.query("insert into storage.objects(bucket_id,name) values('request-attachments',$1)",[next]);await db.query('select public.replace_request_attachment($1,2,$2,$3)',[id,replacement,next]);await db.query('select public.replace_request_attachment($1,2,$2,$3)',[id,replacement,next]);
 await asUser(staff);const notifications=await events('document_upload');assert.equal(notifications.length,2);assert.ok(notifications.some(n=>n.title==='Replacement document uploaded'));assert.ok(notifications.every(n=>n.reference==='INBOX-UPLOAD'));
});

test('resident cancellations reach request staff and staff cancellations do not pretend to be resident actions',async()=>{
 const row=await booking();await db.query("select public.manage_appointment($1,'cancel',$2,'I cannot attend')",[row.reference,row.version]);await asUser(staff);assert.equal((await events('resident_cancellation')).length,1);
 const another=await booking('INBOX-STAFF-CANCEL');await asUser(staff);await db.query("select public.manage_appointment($1,'cancel',$2,'Office reschedule required')",[another.reference,another.version]);assert.equal((await events('resident_cancellation')).length,1);
});

test('Banoy notifies only for completed unanswered questions or unhelpful feedback, once per question',async()=>{
 const id=randomUUID();await db.query('insert into chatbot_questions(id,owner_id,question) values($1,$2,$3)',[id,residentA,'How does a resident request assistance?']);await asUser(staff);assert.equal((await events('banoy_review')).length,0);
 await root();await db.query("update chatbot_questions set answered=true,answer_text='Approved answer',answered_at=now() where id=$1",[id]);await asUser(staff);assert.equal((await events('banoy_review')).length,0);
 await root();await db.query('update chatbot_questions set helpful=false where id=$1',[id]);await db.query('update chatbot_questions set helpful=false where id=$1',[id]);await asUser(staff);assert.equal((await events('banoy_review')).length,1);
 const other=randomUUID();await root();await db.query('insert into chatbot_questions(id,owner_id,question) values($1,$2,$3)',[other,residentB,'Question without an approved answer']);await db.query("update chatbot_questions set answered_at=now(),answer_text='Please contact the office' where id=$1",[other]);await asUser(staff);assert.equal((await events('banoy_review')).length,2);
});

test('fee and certificate updates link to their transaction without duplicating idempotent operations',async()=>{
 const row=await booking();await asUser(staff);await db.query("update office_settings set fee_tracking_enabled=true where id=1");await db.query("select public.manage_appointment($1,'approve',$2)",[row.reference,row.version]);const fee=randomUUID();
 const args=[fee,row.reference,null,100,'PAID','OR-INBOX','Payment received',null,'Cash at barangay office'];for(let n=0;n<2;n++)await db.query('select public.record_office_fee($1,$2,$3,$4,$5,$6,$7,$8,$9)',args);
 assert.equal((await events('fee_record')).length,1);assert.equal((await events('fee_record'))[0].reference,row.reference);
 const certificate=randomUUID();for(let n=0;n<2;n++)await db.query("select public.issue_certificate($1,$2,null,'Barangay Captain','INBOX-REG',null,null)",[certificate,row.reference]);assert.equal((await events('certificate_record')).length,1);
});

test('inbox search, feature filters, ordering and unread tracking cover every page with stable ties',async()=>{
 for(let i=30;i>=0;i--)await db.query("insert into staff_notifications(permission,kind,title,body,created_at) values($1,'inbox-test',$2,$3,$4)",[i%2?'concerns':'requests','Inbox '+String(i).padStart(2,'0'),'INBOX-SORT fixture',`2026-10-${String(1+i%28).padStart(2,'0')}T00:00:00Z`]);
 await asUser(staff);const first=await inbox({query:'INBOX-SORT',sort:'name_asc'}),second=await inbox({query:'INBOX-SORT',sort:'name_asc',page:1});assert.equal(first.total,31);assert.equal(first.rows[0].title,'Inbox 00');assert.equal(second.rows[0].title,'Inbox 25');assert.equal(second.rows.length,6);
 assert.equal((await inbox({query:'INBOX-SORT',sort:'name_desc'})).rows[0].title,'Inbox 30');assert.equal((await inbox({query:'INBOX-SORT',feature:'concerns'})).total,15);
 const newest=await inbox({query:'INBOX-SORT'});await db.query('select public.mark_staff_notifications_read($1)',[[newest.rows[0].id]]);assert.equal((await inbox({query:'INBOX-SORT',unread:true})).total,30);assert.equal((await inbox({query:'INBOX-SORT',sort:'unread_first'})).rows[0].read,false);
 await rejected(()=>inbox({sort:'injected'}),/sort order/);await rejected(()=>inbox({page:-1}),/valid inbox page/);await rejected(()=>inbox({query:'X'.repeat(201)}),/200 characters/);await rejected(()=>inbox({feature:'private'}),/available inbox feature/);
});

test('limited staff receive all permitted resident features while residents and anonymous users cannot read or forge inbox records',async()=>{
 await root();await db.query("update resident_profiles set role='staff' where id=$1",[residentB]);await db.query("insert into staff_access(user_id,permissions) values($1,'{knowledge,residents}')",[residentB]);
 for(const permission of ['knowledge','residents','requests','concerns','payments','certificates'])await db.query("insert into staff_notifications(permission,kind,title,body) values($1,'privacy','Private feature fixture','Inbox privacy')",[permission]);
 await asUser(residentB);const result=await inbox({query:'Inbox privacy'});assert.equal(result.total,2);assert.deepEqual(new Set(result.rows.map(n=>n.permission)),new Set(['knowledge','residents']));assert.equal((await inbox({query:'Inbox privacy',feature:'payments'})).total,0);
 await rejected(()=>db.query("insert into staff_notifications(permission,kind,title,body) values('knowledge','forged','Forged','Forged')"),/permission denied/);
 await asUser(residentA);await rejected(()=>inbox(),/Staff sign-in/);assert.equal((await db.query('select * from staff_notifications')).rows.length,0);
 await asUser('','anon');await rejected(()=>inbox(),/permission denied/);
});
