import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {validateBookingFields} from '../src/app/bookingValidation.ts';
import {manilaTime} from '../src/app/manilaTime.ts';
const valid={fullName:'N'.repeat(200),address:'A'.repeat(500),validIdType:'Passport',validIdNumber:'I'.repeat(120),requestType:'Other barangay document',otherRequestType:'D'.repeat(200),purpose:'P'.repeat(2000)};
test('booking accepts the database field boundaries and identifies the correct field before uploads',()=>{
 assert.equal(validateBookingFields(valid),null);
 for(const field of ['fullName','address','validIdNumber','otherRequestType','purpose']){const error=validateBookingFields({...valid,[field]:valid[field]+'x'});assert.equal(error.field,field);assert.equal(error.step,['fullName','address','validIdNumber'].includes(field)?1:2);}
 assert.equal(validateBookingFields({...valid,validIdNumber:'ID\nforged'}).field,'validIdNumber');
 assert.equal(validateBookingFields({...valid,purpose:'  '}).field,'purpose');
});
test('office timestamps use Manila even when an input crosses midnight in UTC',()=>{
 assert.match(manilaTime('2026-10-18T17:00:00Z',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false}),/19/);
 assert.equal(manilaTime('invalid'),'Date unavailable');
});
test('non-JSON notification errors retain useful service failure messages',async()=>{
 const source=await fs.readFile(new URL('../src/app/portalData.ts',import.meta.url),'utf8');
 const functionSource=stripTypeScriptTypes(source.slice(source.indexOf('function reportError('),source.indexOf('type ResidentNotification'))+source.slice(source.indexOf('export async function sendResidentNotification('),source.indexOf('export async function getPublicPosts('))).replace(/^export /gm,'');
 for(const [context,expected]of [[new Response('<html>Unavailable</html>',{status:502}),/provider unavailable/i],[Response.json({error:'Office notification limit reached'},{status:429}),/Office notification limit reached/]]){
  const scope={Response,console:{error(){}},requireSupabase:()=>({functions:{invoke:async()=>({error:{message:'provider unavailable',context}})}})};vm.runInNewContext(functionSource,scope);await assert.rejects(()=>scope.sendResidentNotification({type:'appointment_status',reference:'TEST',status:'APPROVED'}),expected);
 }
});
