export async function runLandingContentChecks({evaluate,waitFor,check,click,input,navigate,fits,resize,screenshot}){
 const form='form[aria-label="Barangay leadership image"]';
 await resize(320);await evaluate(`window.__review.failRpc=null;window.__review.staff.superadmin=true;window.resetReview('staff','/staff')`);await waitFor(`document.querySelector('aside')`);await navigate('Public site content');await waitFor(`document.querySelector('${form} input[type="file"]')&&!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Publish leadership image').disabled`);
 await check('Superadmin can edit the landing-page leadership photo in Public site content',`document.querySelector('${form}').textContent.includes('Choose a photo, describe it, then publish')`);
 await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['not an image'],'invalid.png',{type:'image/png'}));const field=document.querySelector('${form} input[type="file"]');field.files=transfer.files;field.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Choose a valid')`);
 await check('Invalid leadership photos leave the current image in place',`document.querySelector('${form} img').getAttribute('src').includes('group%20photo.jpg')||document.querySelector('${form} img').getAttribute('src').includes('group photo.jpg')`);
 await evaluate(`new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=320;const context=canvas.getContext('2d');context.fillStyle='#123323';context.fillRect(0,0,640,320);canvas.toBlob(blob=>{const transfer=new DataTransfer();transfer.items.add(new File([blob],'barangay-leadership.png',{type:'image/png'}));const field=document.querySelector('${form} input[type="file"]');field.files=transfer.files;field.dispatchEvent(new Event('change',{bubbles:true}));resolve(true);},'image/png');})`);
 await waitFor(`document.querySelector('${form} img')?.src.startsWith('data:image/png')`);
 await input(`${form} input[maxlength="240"]`,'Barangay leadership group photo updated by the office');
 await check('The uploaded leadership photo is a draft until it is published',`!window.__review.site_content?.some(row=>row.key==='leadership')&&document.querySelector('${form} img').src.startsWith('data:image/png')`);
 await evaluate(`window.__review.failRpc='save_site_content'`);await click('Publish leadership image');await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Simulated save failure')`);
 await check('A failed leadership publish preserves its selected photo and description',`document.querySelector('${form} img').src.startsWith('data:image/png')&&document.querySelector('${form} input[maxlength="240"]').value==='Barangay leadership group photo updated by the office'`);
 await evaluate(`window.__review.failRpc=null`);await click('Publish leadership image');await waitFor(`window.__review.site_content?.some(row=>row.key==='leadership')&&document.body.textContent.includes('Leadership image published on the landing page')`);
 await fits('Leadership photo editor fits a 320px phone');await screenshot('leadership-image-editor-mobile');
 await evaluate(`window.__review.savedLeadershipPath=window.__review.site_content.find(row=>row.key==='leadership').value.image.slice(16)`);
 await navigate('Audit history');await navigate('Public site content');await waitFor(`document.querySelector('${form} input[maxlength="240"]')?.value==='Barangay leadership group photo updated by the office'`);
 await check('The leadership editor reloads the saved image and retains its published upload',`document.querySelector('${form} img').src.startsWith('data:image/png')&&!window.__review.removedImages.includes(window.__review.savedLeadershipPath)`);
 await resize(1280,900);await fits('Leadership image settings fit desktop');await resize(320);
 await evaluate(`window.resetReview('none','/')`);await waitFor(`document.querySelector('img[alt="Barangay leadership group photo updated by the office"]')?.complete`);
 await check('The public landing page displays the image published by superadmin',`document.querySelector('img[alt="Barangay leadership group photo updated by the office"]').naturalWidth===640`);
 await screenshot('published-leadership-photo-mobile');
 for(const view of ['login','register','forgot']){
  await click('SIGN IN / REGISTER');await waitFor(`document.querySelector('input[autocomplete="current-password"]')`);
  if(view==='register'){await click('Register here');await waitFor(`document.body.textContent.includes('Create resident account')`);}
  if(view==='forgot'){await click('Forgot password?');await waitFor(`document.body.textContent.includes('Email reset link')`);}
  await check(`Resident ${view} has a visible back button to the landing page`,`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Back to public site'&&b.getBoundingClientRect().height>=44)`);
  await click('Back to public site');await waitFor(`document.body.textContent.includes('Barangay services, made easier.')`);
 }
 await check('Returning from resident sign-in restores the published leadership image',`!!document.querySelector('img[alt="Barangay leadership group photo updated by the office"]')&&window.location.pathname==='/'`);
 await evaluate(`window.resetReview('staff','/staff')`);await waitFor(`document.querySelector('aside')`);await navigate('Public site content');await waitFor(`document.querySelector('${form}')&&!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Publish leadership image').disabled`);await click('Use original leadership image');
 await check('Restoring the original leadership image stays a draft until publishing',`window.__review.site_content.find(row=>row.key==='leadership').value.image.startsWith('official-images/')`);
 await click('Publish leadership image');await waitFor(`window.__review.site_content.find(row=>row.key==='leadership').value.image==='officials/group photo.jpg'`);
 await evaluate(`window.resetReview('none','/')`);await waitFor(`document.querySelector('img[alt="Barangay Lagasit officials"]')`);
 await check('Superadmin can restore the original leadership photo',`document.querySelector('img[alt="Barangay Lagasit officials"]').getAttribute('src').includes('group')`);

 await evaluate(`for(const key of ['mission','vision'])window.__review.site_content.push({key,value:'Existing office-approved '+key,version:1});window.resetReview('staff','/staff')`);
 await waitFor(`document.querySelector('aside')`);await navigate('Public site content');
 await waitFor(`document.querySelector('form[aria-label="Barangay mission"] textarea')?.value==='Existing office-approved mission'`);
 await check('Existing text-only mission and vision remain editable',`document.querySelector('form[aria-label="Barangay vision"] textarea').value==='Existing office-approved vision'`);
 for(const key of ['mission','vision']){
  const selector=`form[aria-label="Barangay ${key}"]`,title=key==='mission'?'Mission':'Vision';
  await input(`${selector} textarea`,`Verified ${key} statement.\nSecond office-approved paragraph.`);
  await evaluate(`new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=240;canvas.getContext('2d').fillRect(0,0,640,240);canvas.toBlob(blob=>{const transfer=new DataTransfer();transfer.items.add(new File([blob],${JSON.stringify(key+'-illustration.png')},{type:'image/png'}));const field=document.querySelector(${JSON.stringify(selector+' input[type="file"]')});field.files=transfer.files;field.dispatchEvent(new Event('change',{bubbles:true}));resolve(true);},'image/png');})`);
  await waitFor(`document.querySelector(${JSON.stringify(selector+' img')})?.src.startsWith('data:image/png')`);
  await input(`${selector} input[maxlength="240"]`,`${title} illustration approved by the office`);
  await check(`${title} text and image stay in preview before publishing`,`window.__review.site_content.find(row=>row.key===${JSON.stringify(key)}).value===${JSON.stringify('Existing office-approved '+key)}`);
  if(key==='mission'){
   await evaluate(`window.__review.failRpc='save_site_content'`);await click('Publish mission');await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Simulated save failure')`);
   await check('A failed mission publish preserves its text, selected image and description',`document.querySelector('${selector} textarea').value.startsWith('Verified mission')&&document.querySelector('${selector} img').src.startsWith('data:image/png')&&document.querySelector('${selector} input[maxlength="240"]').value==='Mission illustration approved by the office'`);
   await evaluate(`window.__review.failRpc=null`);
  }
  await click('Publish '+key);await waitFor(`window.__review.site_content.find(row=>row.key===${JSON.stringify(key)}).value?.text?.startsWith('Verified')`);
 }
 await fits('Mission and vision editors and previews fit a 320px phone');await evaluate(`document.querySelector('form[aria-label="Barangay mission"]').scrollIntoView({block:'start'})`);await screenshot('mission-vision-editor-mobile');
 await navigate('Audit history');await navigate('Public site content');await waitFor(`document.querySelector('form[aria-label="Barangay mission"] textarea')?.value.startsWith('Verified')`);
 await check('Reopening Public site content restores both published statement images',`['mission','vision'].every(key=>document.querySelector('form[aria-label="Barangay '+key+'"] img')?.src.startsWith('data:image/png'))`);
 await evaluate(`window.__review.posts=Array.from({length:5},(_,i)=>({id:'layout-news-'+i,title:'Community announcement '+(i+1),content:'Office-approved announcement details. '.repeat(20),type:'Announcement',archived:false,publishedAt:new Date().toISOString()}));window.resetReview('none','/')`);
 await waitFor(`document.querySelector('article[aria-label="Barangay mission"] img')?.complete&&document.querySelector('article[aria-label="Barangay vision"] img')?.complete`);
 await check('Public mission and vision display the published text and images',`['mission','vision'].every(key=>{const article=document.querySelector('article[aria-label="Barangay '+key+'"]');return article.textContent.includes('Verified '+key)&&article.querySelector('img').naturalWidth===640;})`);
 for(const width of [320,768,1280]){
  await resize(width,900);await evaluate(`document.querySelector('#news').scrollIntoView({block:'start'})`);
  await fits(`Mission and vision fit at ${width}px`);
  await check(`Statement cards fit their content at ${width}px`,`['mission','vision'].every(key=>{const article=document.querySelector('article[aria-label="Barangay '+key+'"]');const style=getComputedStyle(article);return Math.abs(article.getBoundingClientRect().bottom-article.lastElementChild.getBoundingClientRect().bottom-parseFloat(style.paddingBottom)-parseFloat(style.borderBottomWidth))<2;})`);
  if(width===768)await check('Mission and vision share a row on tablets',`Math.abs(document.querySelector('article[aria-label="Barangay mission"]').getBoundingClientRect().top-document.querySelector('article[aria-label="Barangay vision"]').getBoundingClientRect().top)<2`);
  if(width===1280)await check('Long announcements do not stretch mission and vision cards',`document.querySelector('#news>div').getBoundingClientRect().height>document.querySelector('article[aria-label="Barangay mission"]').parentElement.getBoundingClientRect().height+100`);
  if(width<1024)await evaluate(`document.querySelector('article[aria-label="Barangay mission"]').scrollIntoView({block:'start'})`);
  await screenshot(`mission-vision-${width}`);
 }
 await resize(320);await evaluate(`window.resetReview('staff','/staff')`);await waitFor(`document.querySelector('aside')`);await navigate('Public site content');await waitFor(`document.querySelector('form[aria-label="Barangay mission"] img')`);
 await click('Remove mission image');await check('Removing a mission image stays a draft until published',`!document.querySelector('form[aria-label="Barangay mission"] img')&&window.__review.site_content.find(row=>row.key==='mission').value.image.startsWith('official-images/')`);
 await click('Publish mission');await waitFor(`window.__review.site_content.find(row=>row.key==='mission').value.image===''`);
 await evaluate(`window.resetReview('none','/')`);await waitFor(`document.querySelector('article[aria-label="Barangay mission"]')?.textContent.includes('Verified mission')`);
 await check('Publishing image removal retains mission text and the separate vision image',`!document.querySelector('article[aria-label="Barangay mission"] img')&&!!document.querySelector('article[aria-label="Barangay vision"] img')`);
}
