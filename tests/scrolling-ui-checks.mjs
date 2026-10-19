export async function runScrollingChecks({evaluate,waitFor,check,click,navigate,resize,screenshot}){
 const noOuter=`document.scrollingElement.scrollHeight<=document.documentElement.clientHeight+1`;
 const noNested=`!Array.from(document.querySelectorAll('main *')).some(e=>e.tagName!=='TEXTAREA'&&['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+2)`;
 await evaluate(`(()=>{const s=window.__review;s.staff.superadmin=true;s.account=s.staff;window.resetReview('staff','/staff');})()`);
 await waitFor(`document.querySelector('table')`);await resize(1280,800);
 await check('Admin dashboard uses the portal scroller without an outer page scrollbar',noOuter);
 await click('VIEW');await waitFor(`document.querySelector('[role="dialog"]')`);
 await check('Request dialog locks the background portal scroller',`!['auto','scroll'].includes(getComputedStyle(document.querySelector('main')).overflowY)`);
 await evaluate(`document.querySelector('[aria-label="Close request details"]').click()`);
 await evaluate(`window.resetReview('resident','/')`);await waitFor(`document.body.textContent.includes('Public Service Portal')`);
 await navigate('Dashboard');await waitFor(`document.body.textContent.includes('Your resident dashboard')`);
 await check('Resident dashboard uses one page scroller',noOuter);
 await evaluate(`(()=>{const s=window.__review;const request=[...s.requests].filter(r=>r.ownerId===s.resident.id&&!r.archived).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt))[0];s.transaction_messages=Array.from({length:20},(_,n)=>({id:'scroll-message-'+n,request_reference:request.reference,author_id:s.resident.id,author_name:s.resident.name,author_role:'Resident',body:'Long thread message '+n+' '+('Message details '.repeat(12)),sent_at:new Date().toISOString()}));})()`);
 await click('View status');await waitFor(`document.body.textContent.includes('Long thread message 19')`);
 await check('Long request conversations use the dashboard scroller instead of a second message scrollbar',noNested);
 await evaluate(`document.querySelector('main').scrollTop=400`);
 await check('Scrolling the resident dashboard leaves the browser page fixed',`document.querySelector('main').scrollTop>0&&document.scrollingElement.scrollTop===0`);
 await screenshot('dashboard-single-scroll-desktop');
 for(const [width,height] of [[320,640],[390,844],[768,1024]]){
  await resize(width,height);if(!await evaluate(`${noOuter}&&${noNested}`))console.log('SCROLL DIAGNOSTIC',await evaluate(`({viewport:innerHeight,document:document.scrollingElement.scrollHeight,client:document.documentElement.clientHeight,body:document.body.scrollHeight,htmlClass:document.documentElement.className,htmlOverflow:getComputedStyle(document.documentElement).overflow,main:{height:document.querySelector('main').clientHeight,scroll:document.querySelector('main').scrollHeight,overflow:getComputedStyle(document.querySelector('main')).overflow,rect:document.querySelector('main').getBoundingClientRect().toJSON()},outside:Array.from(document.body.querySelectorAll('*')).filter(e=>!e.closest('main')&&e.getBoundingClientRect().bottom>innerHeight+100).map(e=>({tag:e.tagName,class:e.className,position:getComputedStyle(e).position,bottom:e.getBoundingClientRect().bottom})).slice(0,8),nested:Array.from(document.querySelectorAll('main *')).filter(e=>e.tagName!=='TEXTAREA'&&['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+2).map(e=>({tag:e.tagName,class:e.className,height:e.clientHeight,scroll:e.scrollHeight}))})`));await check(`Dashboard retains one page scroller at ${width}px`,`${noOuter}&&${noNested}`);
 }
 await resize(320,640);await waitFor(`document.querySelector('aside').getBoundingClientRect().right<=1`);await evaluate(`document.querySelector('main').scrollTop=0`);await screenshot('dashboard-single-scroll-mobile');
 await evaluate(`document.querySelector('main').scrollTop=400`);await navigate('Fees & receipts');await waitFor(`document.querySelector('main').textContent.includes('My fees & receipts')`);
 await check('Opening resident fees from a scrolled dashboard starts at the top',`document.querySelector('main').scrollTop===0`);
 await navigate('Banoy');await waitFor(`document.querySelector('[role="log"]')`);
 await check('Banoy scrolls its conversation without an extra outer scrollbar',`${noOuter}&&getComputedStyle(document.querySelector('main')).overflowY==='hidden'`);
 await check('Banoy keeps the message composer inside the visible portal',`document.querySelector('[aria-label="Your question for Banoy"]').getBoundingClientRect().bottom<=document.querySelector('main').getBoundingClientRect().bottom+1`);
 await resize(320,640);await evaluate(`document.querySelector('[aria-label="Open menu"]').click()`);
 await check('Mobile navigation locks the page behind the menu',`getComputedStyle(document.querySelector('main')).overflowY==='hidden'`);
 await evaluate(`document.querySelector('[aria-label="Close navigation"]').click()`);
 await evaluate(`window.resetReview('staff','/staff')`);await waitFor(`document.querySelector('table')`);await resize(1280,800);
 for(const [label,title] of [['Services & booking','Services & booking settings'],['Fee records','Fees and receipt records'],['Resident masterlist','Resident masterlist'],['Concerns & feedback','Resident concerns and feedback'],['Public site content','Public site content']]){
  await navigate(label);await waitFor(`document.querySelector('main').textContent.includes(${JSON.stringify(title)})`);
  await check(`${label} has no extra document or nested page scrollbar`,`${noOuter}&&${noNested}`);
 }
 await evaluate(`window.resetReview('none','/')`);await waitFor(`document.body.textContent.includes('Barangay Contact Information')`);
 await check('Public pages keep normal browser scrolling after leaving the portal',`!document.documentElement.classList.contains('portal-active')&&document.scrollingElement.scrollHeight>innerHeight`);
}
