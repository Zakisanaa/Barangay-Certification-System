import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as retrieval from '../supabase/functions/banoy-chat/retrieval.ts';
import {getRecognizedServiceFaq} from '../src/app/serviceFaq.ts';
test('Banoy considers approved answers beyond the former 1000-entry limit',async()=>{
 const entries=Array.from({length:1030},(_,index)=>({id:'entry-'+index,title:'Topic '+index,question:'Approved question number '+index,answer:'Approved answer '+index,examples:[],active:true,source_key:null,updated_at:new Date().toISOString(),trained_at:null}));
 const ranges=[];function from(table){const filters=[];let start=0,end=999;const b={select(){return b;},eq(key,value){filters.push(row=>row[key]===value);return b;},order(){return b;},range(a,z){start=a;end=z;ranges.push([a,z]);return b;},update(){return b;},then(resolve,reject){return Promise.resolve({data:table==='chatbot_knowledge'?entries.filter(row=>filters.every(test=>test(row))).slice(start,end+1):[],error:null}).then(resolve,reject);}};return b;}
 const client={from,auth:{async getUser(){return{data:{user:{id:'resident'}},error:null};}},async rpc(name){return{data:name==='reserve_chatbot_question'?crypto.randomUUID():false,error:null};}};let handler;
 const source=stripTypeScriptTypes((await fs.readFile(new URL('../supabase/functions/banoy-chat/index.ts',import.meta.url),'utf8')).replace(/^import .*\r?\n/gm,''));
 vm.runInNewContext(source,{...retrieval,getRecognizedServiceFaq,createClient:()=>client,Deno:{env:{get:()=> 'unit-test-value'},serve:fn=>{handler=fn;}},Response,Request,crypto,console,Date});
 const response=await handler(new Request('https://unit.test/banoy',{method:'POST',headers:{Authorization:'Bearer resident'},body:JSON.stringify({action:'ask',question:entries[1029].question})}));assert.equal(response.status,200);const result=await response.json();assert.equal(result.answer,entries[1029].answer);assert.equal(result.answered,true);assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
});
