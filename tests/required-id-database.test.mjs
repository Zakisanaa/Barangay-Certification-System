import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');await asUser(residentA);});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function rejected(work,pattern){await db.exec('savepoint expected_failure');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint expected_failure;release savepoint expected_failure');}}
const payload=(overrides={})=>({reference:'ID-BOOKING',full_name:'Juan Dela Cruz',address:'Barangay Lagasit',id_review_acknowledged:true,voter_id:"Voter's ID: 123",request_type:'Barangay Clearance',purpose:'Employment',appointment_date:day,time_slot:'8:00 AM - 9:00 AM',delivery_format:'Hardcopy',...overrides});
const submit=async data=>(await db.query("select * from public.submit_document_request($1,'[]')",[JSON.stringify(data)])).rows[0];

test('every ID type requires an actual attachment, including through the booking RPC',async()=>{
 for(const type of ["Voter's ID",'School ID','Philippine National ID (PhilID)',"Driver's License",'Other government-issued ID']){
  await rejected(()=>submit(payload({voter_id:`${type}: 123`})),/Attach an image of your valid ID/);
 }
 await rejected(()=>submit(payload({school_id_image_path:'  '})),/Attach an image of your valid ID/);
 assert.equal((await db.query('select count(*)::int n from public.appointment_requests')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.notification_outbox')).rows[0].n,0);
});

test('a direct appointment insert cannot bypass the required-ID rule',async()=>{
 await rejected(()=>db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,id_review_acknowledged) values('ID-DIRECT',$1,'Juan Dela Cruz','Barangay Lagasit','Passport: 123','Barangay Clearance','Employment',$2,'8:00 AM - 9:00 AM','Hardcopy',true)",[residentA,day]),/Attach an image of your valid ID/);
});

test('an ID must exist, be fresh, and belong to the resident and booking reference',async()=>{
 const path=`${residentA}/ID-BOOKING/attempt/school-id.png`;
 await rejected(()=>submit(payload({school_id_image_path:path})),/missing or expired/);
 await rejected(()=>submit(payload({school_id_image_path:`${residentB}/ID-BOOKING/school-id.png`})),/belong to this resident and request/);
 await rejected(()=>submit(payload({school_id_image_path:`${residentA}/DIFFERENT-BOOKING/school-id.png`})),/belong to this resident and request/);
 await db.query("insert into storage.objects(bucket_id,name) values('resident-school-ids',$1)",[path]);
 await db.exec('reset role');await db.query("update storage.objects set created_at=now()-interval '25 hours' where name=$1",[path]);await asUser(residentA);
 await rejected(()=>submit(payload({school_id_image_path:path})),/missing or expired/);
});

test('a submitted non-school ID is retained, immutable, and visible only to authorized reviewers',async()=>{
 const image=await uploadBookingId(db,residentA,'ID-BOOKING');const row=await submit(payload({school_id_image_path:image}));assert.equal(row.school_id_image_path,image);
 assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[image])).rows.length,0);
 assert.equal((await db.query('update public.appointment_requests set school_id_image_path=null where reference=$1 returning reference',[row.reference])).rows.length,0);
 assert.equal((await db.query('select school_id_image_path from public.appointment_requests where reference=$1',[row.reference])).rows[0].school_id_image_path,image);
 await asUser(residentB);assert.equal((await db.query('select * from storage.objects where name=$1',[image])).rows.length,0);
 await asUser(staff);assert.equal((await db.query('select * from storage.objects where name=$1',[image])).rows.length,1);
 await rejected(()=>db.query('update public.appointment_requests set school_id_image_path=null where reference=$1',[row.reference]),/cannot be changed|cannot change|original|Submitted/i);
 const approved=(await db.query("select * from public.manage_appointment($1,'approve',$2)",[row.reference,row.version])).rows[0];assert.equal(approved.status,'APPROVED');
});

test('legacy appointments without an uploaded ID can still be processed by staff',async()=>{
 await asUser('', 'service_role');await db.exec('reset role;set constraints all immediate;alter table public.appointment_requests disable trigger validate_appointment;alter table public.appointment_requests disable trigger identity_request');
 let row;try{row=(await db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,id_review_acknowledged) values('ID-LEGACY',$1,'Juan Dela Cruz','Barangay Lagasit','Voter''s ID: 123','Barangay Clearance','Employment',$2,'8:00 AM - 9:00 AM','Hardcopy',true) returning *",[residentA,day])).rows[0];}finally{await db.exec('alter table public.appointment_requests enable trigger validate_appointment;alter table public.appointment_requests enable trigger identity_request');}
 await asUser(staff);const approved=(await db.query("select * from public.manage_appointment($1,'approve',$2)",[row.reference,row.version])).rows[0];assert.equal(approved.status,'APPROVED');assert.equal(approved.school_id_image_path,null);
});
