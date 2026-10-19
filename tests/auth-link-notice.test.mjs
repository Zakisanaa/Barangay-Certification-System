import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readAuthLinkNotice} from '../src/app/authLinkNotice.ts';
test('email confirmation callbacks explain the remaining inbox confirmation without exposing tokens',()=>{
 for(const location of [{search:'',hash:'#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email'},{search:'',hash:'#access_token=private-token&type=email_change&refresh_token=private-refresh'}]){
  const notice=readAuthLinkNotice(location);assert.equal(notice.error,false);assert.match(notice.text,/other inbox/);assert.ok(!notice.text.includes('private'));
 }
});
test('expired links show an actionable error and ordinary or recovery navigation is left alone',()=>{
 assert.equal(readAuthLinkNotice({search:'?error_code=otp_expired',hash:''}).error,true);
 assert.equal(readAuthLinkNotice({search:'',hash:'#error=access_denied&error_description=%3Cscript%3E'}).error,true);
 assert.equal(readAuthLinkNotice({search:'',hash:'#type=recovery&access_token=private'}),null);
 assert.equal(readAuthLinkNotice({search:'',hash:''}),null);
});
