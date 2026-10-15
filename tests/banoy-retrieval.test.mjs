import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confidentWordingMatch,confidentSemanticMatch,validateKnowledge} from '../supabase/functions/banoy-chat/retrieval.ts';
const entry=(id,question,answer='Approved answer',extra={})=>({id,title:question,question,answer,examples:[],active:true,source_key:null,updated_at:'test',...extra});
test('Banoy matches approved alternate Filipino wording and never returns a draft',()=>{
  const entries=[entry('published','Where can I request assistance?','Contact staff.',{examples:['Saan ako puwedeng humingi ng tulong?']}),entry('draft','Secret draft','Unapproved answer',{active:false})];
  assert.equal(confidentWordingMatch('saan ako puwedeng humingi ng tulong',entries).id,'published');
  assert.equal(confidentWordingMatch('Secret draft',entries),null);
  assert.equal(confidentWordingMatch('What is the weather forecast?',entries),null);
});
test('semantic selection rejects weak or ambiguous results and ignores inactive knowledge',()=>{
  const entries=[entry('a','First question'),entry('b','Second question'),entry('draft','Hidden',{},{active:false})];
  assert.equal(confidentSemanticMatch([{id:'a',similarity:.91},{id:'b',similarity:.80}],entries).id,'a');
  assert.equal(confidentSemanticMatch([{id:'a',similarity:.91},{id:'b',similarity:.90}],entries),null);
  assert.equal(confidentSemanticMatch([{id:'a',similarity:.65}],entries),null);
  assert.equal(confidentSemanticMatch([{id:'draft',similarity:.99}],entries),null);
});
test('conflicting exact answers ask for clarification instead of picking an arbitrary answer',()=>{
  assert.equal(confidentWordingMatch('Assistance',[entry('a','Assistance','Answer A'),entry('b','Assistance','Answer B')]),null);
});
test('knowledge validation bounds training content and preserves literal instructions as plain text',()=>{
  const data={title:'Topic',question:'Question',answer:'Approved answer',examples:[' Question variant ','Question variant'],active:true};
  assert.deepEqual(validateKnowledge(data).examples,['Question variant']);
  assert.throws(()=>validateKnowledge({...data,answer:' '.repeat(10)}),/valid answer/);
  assert.throws(()=>validateKnowledge({...data,examples:Array(16).fill('extra')}),/15 alternate/);
  assert.throws(()=>validateKnowledge({...data,active:'true'}),/whether to publish/);
});
