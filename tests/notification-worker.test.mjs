import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendQueuedNotification} from '../supabase/functions/process-notifications/send.ts';
import {validateProfileFields} from '../src/app/profileValidation.ts';

const job={id:'queue-id',lease_token:'lease',send_payload:{from:'Office <sender@example.test>',to:['resident@example.test'],subject:'Request update',text:'Approved.'}};
test('notification retries preserve the provider idempotency key and exact saved payload',async()=>{
  const calls=[];
  const provider=async(url,options)=>{calls.push({url,...options});return Response.json({id:'provider-id'});};
  assert.deepEqual(await sendQueuedNotification(job,'test-key',provider),{providerId:'provider-id',error:null});
  await sendQueuedNotification(job,'test-key',provider);
  assert.equal(calls[0].headers['Idempotency-Key'],'notification/queue-id');
  assert.equal(calls[0].body,calls[1].body);assert.deepEqual(JSON.parse(calls[0].body),job.send_payload);
});
test('provider failures and unknown outcomes remain retryable rather than falsely marked sent',async()=>{
  for(const provider of [async()=>new Response('Unavailable',{status:503}),async()=>{throw new Error('network');},async()=>Response.json({}),async()=>new Response('invalid-json')]){
    const result=await sendQueuedNotification(job,'test-key',provider);assert.equal(result.providerId,null);assert.ok(result.error);
  }
});
test('profile validation catches whitespace and malformed contact numbers before network requests',()=>{
  const valid={firstName:' Juan ',lastName:' Dela Cruz ',contactNumber:'+63 (917) 123-4567',address:' Lagasit '};
  assert.deepEqual(validateProfileFields(valid),{firstName:'Juan',lastName:'Dela Cruz',contactNumber:'+639171234567',address:'Lagasit'});
  for(const fields of [{firstName:' '},{lastName:''},{address:' '},{contactNumber:'letters'},{contactNumber:'++639171234567'},{contactNumber:'123'},{firstName:'A'.repeat(101)}])assert.throws(()=>validateProfileFields({...valid,...fields}),/Enter a/);
});
