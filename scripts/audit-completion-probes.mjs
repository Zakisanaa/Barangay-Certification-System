// Isolated workflow audit. All writes run inside an in-memory test database.
// No production credentials, provider calls, or real emails are used.
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,residentA,staff,uploadBookingId} from '../tests/helpers/database.mjs';

const {db,asUser,day}=await createTestDatabase();
const results={isolated:true,productionWrites:false};
try{
 await db.exec('begin');
 await asUser(staff);
 await db.query('update public.office_settings set fee_tracking_enabled=true where id=1');
 await db.query("update public.service_catalog set fee_amount=75 where request_type='Barangay Clearance'");
 const walk=(await db.query("select * from public.save_walk_in(p_id=>gen_random_uuid(),p_name=>'Audit resident',p_contact=>'',p_service=>'Barangay Clearance',p_purpose=>'Isolated audit')")).rows[0];
 const exemption=(await db.query("select * from public.record_office_fee(gen_random_uuid(),null,$1,0,'EXEMPT',null,'Isolated exemption audit')",[walk.id])).rows[0];
 const tryAction=async(sql,params)=>{await db.exec('savepoint audit_action');try{await db.query(sql,params);return{allowed:true};}catch(error){return{allowed:false,reason:error.message};}finally{await db.exec('rollback to savepoint audit_action;release savepoint audit_action');}};
 results.voidExemption=await tryAction("select public.record_office_fee(gen_random_uuid(),null,$1,0,'VOIDED',null,'Correct a mistaken exemption',$2)",[walk.id,exemption.id]);
 results.payAfterMistakenExemption=await tryAction("select public.record_office_fee(gen_random_uuid(),null,$1,75,'PAID','AUDIT-OR','Correct a mistaken exemption')",[walk.id]);

 await asUser(residentA);const reference='AUDIT-'+randomUUID(),path=await uploadBookingId(db,residentA,reference);
 let request=(await db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path,id_review_acknowledged) values($1,$2,'Audit resident','Barangay Lagasit','Passport: AUDIT','Barangay Clearance','Isolated audit',$3,'8:00 AM - 9:00 AM','Hardcopy',$4,true) returning *",[reference,residentA,day,path])).rows[0];
 const paymentInfo=async()=>(await db.query('select public.resident_payment_info($1) info',[reference])).rows[0].info;
 const quoted=await paymentInfo();
 await asUser(staff);await db.query("update public.service_catalog set fee_amount=125 where request_type='Barangay Clearance'");
 await asUser(residentA);const changed=await paymentInfo();
 results.existingRequestFeeChangesWithCatalog={before:Number(quoted.amount),after:Number(changed.amount),changed:Number(quoted.amount)!==Number(changed.amount)};
 await asUser(staff);
 request=(await db.query("select * from public.manage_appointment($1,'approve',$2)",[reference,request.version])).rows[0];
 results.issueCertificateWithoutFee=await tryAction("select * from public.issue_certificate(gen_random_uuid(),$1,null,'Audit signatory')",[reference]);
 request=(await db.query("select * from public.manage_appointment(p_reference=>$1,p_action=>'collect',p_expected_version=>$2,p_recipient=>'Audit recipient')",[reference,request.version])).rows[0];
 request=(await db.query("select * from public.manage_appointment($1,'complete',$2)",[reference,request.version])).rows[0];
 results.completeWithoutFee={status:request.status,feeRecords:Number((await db.query('select count(*) n from public.fee_records where request_reference=$1',[reference])).rows[0].n)};
 results.completedWithoutRegister={status:request.status,registerEntries:Number((await db.query('select count(*) n from public.certificate_register where request_reference=$1',[reference])).rows[0].n)};
 await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/completion-workflow-probes.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
}catch(error){console.error('Audit probe failed:',error.message);process.exitCode=1;}finally{await db.exec('rollback');await db.close();}
