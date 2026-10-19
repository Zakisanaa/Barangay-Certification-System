import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authLinkNoticePath,readAuthLinkNotice} from '../src/app/authLinkNotice.ts';
test('the first inbox callback explains the remaining confirmation while the final callback checks the current status',()=>{
 const pending=readAuthLinkNotice({search:'',hash:'#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email'});
 assert.equal(pending.error,false);assert.equal(pending.status,'pending');assert.match(pending.text,/other inbox/);
 const final=readAuthLinkNotice({search:'',hash:'#access_token=private-token&type=email_change&refresh_token=private-refresh'});
 assert.equal(final.error,false);assert.equal(final.status,'accepted');assert.doesNotMatch(final.text,/other inbox|private/);
});

test('clearing callback notices preserves auth credentials and unrelated navigation',()=>{
 const location={pathname:'/staff',search:'?tab=profile&message=Confirmation+link+accepted',hash:'#access_token=private-token&type=email_change&refresh_token=private-refresh'};
 assert.equal(authLinkNoticePath(location),'/staff?tab=profile#access_token=private-token&refresh_token=private-refresh');
 assert.equal(authLinkNoticePath({pathname:'/',search:'?error_code=otp_expired&from=email',hash:'#error=access_denied&error_description=Expired'}),'/?from=email');
 for(const hash of ['#type=recovery&access_token=private','#type=invite&access_token=private','#office-details'])assert.equal(authLinkNoticePath({pathname:'/',search:'?next=%2Fprofile',hash}),'/?next=%2Fprofile'+hash);
});

test('an SDK-consumed callback is captured early and clearing it releases the cached notice',async()=>{
 const original=globalThis.window;
 const browser={location:new URL('https://portal.example/#type=email_change'),history:{state:{keep:true},replaceState(state,title,path){this.lastState=state;browser.location=new URL(path,browser.location);}}};
 globalThis.window=browser;
 try{
  const captured=await import('../src/app/authLinkNotice.ts?early-capture');
  browser.location.hash='';
  assert.equal(captured.authLinkNotice.status,'accepted');
  captured.clearAuthLinkNotice();
  assert.equal(captured.authLinkNotice,null);assert.deepEqual(browser.history.lastState,{keep:true});
 }finally{if(original===undefined)delete globalThis.window;else globalThis.window=original;}
});
test('expired links show an actionable error and ordinary or recovery navigation is left alone',()=>{
 assert.equal(readAuthLinkNotice({search:'?error_code=otp_expired',hash:''}).error,true);
 assert.equal(readAuthLinkNotice({search:'',hash:'#error=access_denied&error_description=%3Cscript%3E'}).error,true);
 assert.equal(readAuthLinkNotice({search:'',hash:'#type=recovery&access_token=private'}),null);
 assert.equal(readAuthLinkNotice({search:'',hash:''}),null);
});
