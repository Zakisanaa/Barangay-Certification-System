import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getRecognizedServiceFaq} from '../src/app/serviceFaq.ts';
test('Banoy explains the mandatory ID attachment for booking and ID questions',()=>{
 const config={services:[],office:{contact_number:'',contact_email:'',address:'',office_hours:''}};
 for(const question of ['How do I book an appointment?','Do I have to upload my ID?','Kailangan ba ng ID?']){
  const answer=getRecognizedServiceFaq(question,config);assert.match(answer,/Every new appointment requires an attached photo/);assert.match(answer,/regardless of ID type/);assert.match(answer,/5 MB/);assert.match(answer,/does not automatically approve/);
  assert.match(answer,/Good Moral has no additional document requirements; the booking ID is still required/);
 }
});
