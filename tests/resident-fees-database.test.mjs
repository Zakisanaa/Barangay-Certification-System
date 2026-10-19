import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function history(options={}){return(await db.query('select public.resident_fee_records($1,$2,$3) result',[options.page??0,options.query??'',options.sort??'newest'])).rows[0].result;}
async function rejected(work,pattern){await db.exec('savepoint denied');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint denied;release savepoint denied');}}
async function setup(){
 await asUser(residentA);const reference='RESIDENT-FEE-'+randomUUID(),path=await uploadBookingId(db,residentA,reference);
 const request=(await db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path,id_review_acknowledged) values($1,$2,'Resident ledger test','Barangay Lagasit','Passport: 123','Barangay Clearance','Testing',$3,'8:00 AM - 9:00 AM','Hardcopy',$4,true) returning *",[reference,residentA,day,path])).rows[0];
 await asUser(staff);await db.query('update public.office_settings set fee_tracking_enabled=true where id=1');
 const payment=(await db.query("select * from public.record_office_fee(gen_random_uuid(),$1,null,75,'PAID','OR-OWN-75','Office payment',null,'Cash at barangay office')",[reference])).rows[0];return{request,payment};
}
test('a staff fee entry is visible only to its owning resident without staff access',async()=>{
 const {request,payment}=await setup();
 await asUser(residentA);const data=await history();assert.equal(data.total,1);assert.equal(data.rows[0].id,payment.id);assert.equal(data.rows[0].request_reference,request.reference);assert.equal(data.rows[0].request_type,'Barangay Clearance');assert.equal(data.rows[0].receipt_reference,'OR-OWN-75');assert.equal(data.rows[0].payment_method,'Cash at barangay office');assert.equal(Number(data.net),75);assert.equal('recorded_by' in data.rows[0],false);
 await asUser(residentB);assert.equal((await history()).total,0);
 await asUser('','anon');await rejected(()=>history(),/permission denied|Sign in/i);
});
test('resident history includes refunds, corrected originals, and archived appointments',async()=>{
 const {request,payment}=await setup();
 await db.query("select public.record_office_fee(gen_random_uuid(),$1,null,75,'REFUNDED',null,'Authorized refund',$2,'Cash at barangay office')",[request.reference,payment.id]);
 await db.query("select public.manage_appointment($1,'reject',$2,'Document not needed')",[request.reference,request.version]);await db.query('update public.appointment_requests set archived=true where reference=$1',[request.reference]);
 await asUser(residentA);const data=await history();assert.equal(data.total,2);assert.equal(Number(data.net),0);assert.ok(data.rows.every(row=>row.archived));assert.equal(data.rows.find(row=>row.id===payment.id).corrected,true);assert.equal(data.rows.find(row=>row.id===payment.id).correction_status,'REFUNDED');
});
test('resident search, amount sorting, and totals cover all pages and reject invalid input',async()=>{
 await db.exec('reset role;set local session_replication_role=replica');
 for(let n=0;n<31;n++){
  const reference='LEDGER-'+String(n).padStart(2,'0');
  await db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format) values($1,$2,'Fixture resident','Barangay Lagasit','Passport: 123','Barangay Clearance','Ledger fixture',$3,'8:00 AM - 9:00 AM','Hardcopy')",[reference,residentA,day]);
  await db.query("insert into public.fee_records(id,request_reference,amount,status,receipt_reference,note,recorded_by) values(gen_random_uuid(),$1,$2,'PAID',$3,'Ledger fixture',$4)",[reference,n+1,'OR-'+String(n).padStart(2,'0'),staff]);
 }
 await db.exec('set local session_replication_role=origin');await asUser(residentA);
 const first=await history({sort:'amount_high'}),second=await history({sort:'amount_high',page:1});assert.equal(first.total,31);assert.equal(first.rows.length,25);assert.equal(Number(first.rows[0].amount),31);assert.equal(Number(second.rows[0].amount),6);assert.equal(Number(first.net),496);
 const found=await history({query:'OR-30'});assert.equal(found.total,1);assert.equal(found.rows[0].request_reference,'LEDGER-30');
 await rejected(()=>history({page:-1}),/valid page/);await rejected(()=>history({query:'x'.repeat(201)}),/200 characters/);await rejected(()=>history({sort:'invalid'}),/sort order/);
});
