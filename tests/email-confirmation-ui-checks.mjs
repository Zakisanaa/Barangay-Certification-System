export async function runEmailConfirmationChecks({evaluate,waitFor,check,click,resize,screenshot}){
 const banner='[aria-label="Email confirmation"]';
 const pending='/#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email';
 await resize(320);
 await evaluate(`window.__review.pendingEmail={};window.__review.failEmailStatus=false;window.resetReview('resident','/?tab=profile#type=email_change')`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('Your email address has been updated')`);
 await check('Completed email changes show success without asking for another confirmation',`!document.querySelector('${banner}').textContent.includes('other inbox')&&window.location.search==='?tab=profile'&&window.location.hash===''`);
 await check('Email confirmation feedback fits a 320px phone',`document.querySelector('${banner}').scrollWidth<=document.querySelector('${banner}').clientWidth`);
 await screenshot('completed-email-change-mobile');
 await waitFor(`!document.querySelector('${banner}')`);
 await check('Completed email feedback dismisses itself automatically',`!document.querySelector('${banner}')`);
 await evaluate(`window.resetReview('resident',window.location.pathname+window.location.search+window.location.hash)`);
 await waitFor(`document.querySelector('aside')`);
 await check('Completed callback feedback stays cleared after the app remounts',`!document.querySelector('${banner}')`);

 await evaluate(`window.resetReview('none',${JSON.stringify(pending)})`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('other inbox')&&window.location.hash===''`);
 await check('A signed-out first confirmation still explains the other-inbox step',`document.querySelector('${banner}').getAttribute('role')==='status'`);
 await click('Dismiss message');
 await evaluate(`window.__review.authCallback('TOKEN_REFRESHED');window.resetReview('none',window.location.pathname)`);
 await waitFor(`document.body.textContent.includes('Barangay Contact Information')`);
 await check('Dismissing a first-inbox notice clears it across navigation',`!document.querySelector('${banner}')`);

 await evaluate(`window.__review.pendingEmail[window.__review.resident.id]='changed@example.test';window.resetReview('resident',${JSON.stringify(pending)})`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('other inbox')&&!!document.querySelector('aside')`);
 await evaluate(`window.__review.pendingEmail[window.__review.resident.id]='';window.__review.authCallback('USER_UPDATED')`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('Your email address has been updated')`);
 await check('The banner updates when the last inbox confirmation completes',`!document.querySelector('${banner}').textContent.includes('other inbox')`);
 await click('Dismiss message');
 await evaluate(`window.__review.authCallback('TOKEN_REFRESHED');window.dispatchEvent(new Event('focus'))`);
 await check('Auth refreshes do not reopen a dismissed success message',`!document.querySelector('${banner}')`);

 await evaluate(`window.__review.pendingEmail[window.__review.resident.id]='changed@example.test';window.resetReview('resident',${JSON.stringify(pending)})`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('other inbox')`);
 await evaluate(`window.__review.pendingEmail[window.__review.resident.id]='';window.dispatchEvent(new Event('focus'))`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('Your email address has been updated')`);
 await check('Returning from the other inbox checks the current email status',`!document.querySelector('${banner}').textContent.includes('other inbox')`);
 await click('Dismiss message');

 await evaluate(`window.__review.failEmailStatus=true;window.resetReview('resident','/#type=email_change')`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('Open My profile to check')`);
 await check('Unavailable email status never falsely claims the change is complete',`!document.querySelector('${banner}').textContent.includes('has been updated')&&!document.querySelector('${banner}').textContent.includes('other inbox')`);
 await evaluate(`window.__review.failEmailStatus=false;window.dispatchEvent(new Event('focus'))`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('Your email address has been updated')`);
 await click('Dismiss message');

 await evaluate(`window.__review.authInitialization=new Promise(resolve=>window.__review.finishAuthInitialization=resolve);window.resetReview('resident','/#type=email_change&access_token=test-access&refresh_token=test-refresh')`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('Checking your current email status')`);
 await check('The auth SDK gets time to consume the confirmation callback',`window.location.hash.includes('type=email_change')`);
 await click('Dismiss message');
 await evaluate(`window.__review.finishAuthInitialization();window.__review.authInitialization=null`);
 await waitFor(`!window.location.hash.includes('type=email_change')`);
 await check('Dismissal during SDK initialization stays dismissed and preserves session tokens',`!document.querySelector('${banner}')&&window.location.hash.includes('access_token=test-access')&&window.location.hash.includes('refresh_token=test-refresh')`);
 await evaluate(`window.resetReview('none','/#error=access_denied&error_code=otp_expired')`);
 await waitFor(`document.querySelector('${banner}')?.getAttribute('role')==='alert'&&window.location.hash===''`);
 await click('Dismiss message');
 await evaluate(`window.resetReview('none',window.location.pathname)`);
 await waitFor(`document.body.textContent.includes('Barangay Contact Information')`);
 await check('Dismissed expired-link errors do not return on the next visit',`!document.querySelector('${banner}')`);
 await evaluate(`window.resetReview('staff','/staff#type=email_change')`);
 await waitFor(`document.querySelector('${banner}')?.textContent.includes('Your email address has been updated')&&!!document.querySelector('aside')`);
 await check('Staff receive the same completed-email feedback',`!document.querySelector('${banner}').textContent.includes('other inbox')`);
 await click('Dismiss message');
}
