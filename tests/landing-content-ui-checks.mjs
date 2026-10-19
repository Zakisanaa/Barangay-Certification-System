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
}
