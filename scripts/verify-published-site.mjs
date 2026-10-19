import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const origin = 'https://barangay-certification-system-eta.vercel.app';
const output = path.join(process.cwd(), 'test-results');
await fs.mkdir(output, { recursive: true });
const chunks=new Map();
async function readPublishedChunks(entry){
 const queue=[new URL(entry,origin).href];
 while(queue.length){
  const batch=[...new Set(queue.splice(0,8))].filter(url=>!chunks.has(url));
  const results=await Promise.allSettled(batch.map(async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,`Published module must load: ${new URL(url).pathname}`);return{url,code:await response.text()};}));
  for(const result of results){if(result.status==='rejected')throw result.reason;const{url,code}=result.value;chunks.set(url,code);for(const match of code.matchAll(/["']((?:\.\/|\/)?(?:assets\/)?[\w-]+\.js)["']/g)){const reference=match[1];const dependency=new URL(reference.startsWith('assets/')?'/'+reference:reference,url);if(dependency.origin===origin&&!chunks.has(dependency.href))queue.push(dependency.href);}}
  assert.ok(chunks.size<100,'Module traversal must remain bounded');
 }
 return [...chunks.values()].join('\n');
}
for (const route of ['/', '/staff']) {
  const response = await fetch(origin + route, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${route} must load`);
  const html = await response.text();
  const asset = html.match(/<script[^>]+src="([^"]+\.js)"/)[1];
  const script = await fetch(new URL(asset, origin), { signal: AbortSignal.timeout(30000) });
  assert.equal(script.status, 200, 'Published JavaScript must load');
  const bundle = await readPublishedChunks(asset);
  for (const marker of ['manage_appointment', 'hardcopy_collected_at', 'notification_outbox', 'tzrgvpawvzjrabewdvup', 'manage-staff', 'staff_inbox', 'certificate_register', 'save_site_content', 'submit_document_request','Attach a photo of your ID','Required for every ID type.','conversation-attachments','send_transaction_message','Attach images or files','portal_list','request_summary','submit_resident_concern','save_walk_in_shift','save_operating_slot_versioned','save_reviewed_closure','id_review_acknowledged','appointment_pdf_retry','Resume PDF upload','answer_text','Refresh ID image link','Read full announcement','Asia/Manila','Discard your unsaved changes?','banoy-chatbot.webp','portal_list_sorted','office_record_list','What would you like to manage?','Look up request and fee','create_document_service_with_fee','Fee amount (PHP)','resident_fee_records','My fees & receipts','portal-main']) {
    assert.ok(bundle.includes(marker), `Published bundle must contain ${marker}`);
  }
  for(const marker of ['Additional document uploads:','ADDITIONAL FILES','office_transaction_list','Awaiting first fee record','Next steps and related records','Select for issuance','Related settings are together.','1. Document details and fee','2. Required uploads','3. Certificate template (optional)','Choose a saved certificate document','Recent notification updates','resident_notification_feed','Mark these read','Resident activity notifications','Unread first','Resident feature','Retry audit history','Awaiting email confirmation:','Resend confirmation links','This confirmation link has expired'])assert.ok(bundle.includes(marker),`Published workflows must include ${marker}`);
  console.log(`PASS: ${route} serves the admin/product frontend connected to the correct Supabase project`);
  for(const marker of ['Publish leadership image','Back to public site','Your email address has been updated.'])assert.ok(bundle.includes(marker),`Published interface must include ${marker}`);
  assert.ok(!bundle.includes('If your email change is still pending, confirm the newest link'),'The stale email confirmation message must be removed');
}
const profile = await fs.mkdtemp(path.join(output, 'production-chrome-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let launchError, socket;
chrome.on('error', error => { launchError = error; });
try {
  let tab;
  for (let attempt = 0; attempt < 100 && !tab; attempt++) {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw new Error('Chrome exited before verification.');
    try {
      const port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      tab = (await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(2000) })).json()).find(item => item.type === 'page');
    } catch { /* The browser may still be starting. */ }
    if (!tab) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(tab, 'The verification browser must start');
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser connection timed out.')), 10000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Browser connection failed.')); }, { once: true });
  });
  const pending = new Map(), exceptions = [], apiFailures = [],loadedJs=[];
  let nextId = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.responseReceived') {
      const response = message.params.response;
      if(response.url.startsWith(origin)&&/\.js(?:\?|$)/.test(response.url))loadedJs.push(response.url);
      if (response.url.startsWith('https://tzrgvpawvzjrabewdvup.supabase.co/') && response.status >= 400) apiFailures.push(response.status);
    }
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id); clearTimeout(handler.timer);
    if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const handler of pending.values()) { clearTimeout(handler.timer); handler.reject(new Error('Browser connection closed.')); }
    pending.clear();
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await evaluate(`!!(${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Published page did not become ready.');
  };
  await call('Runtime.enable'); await call('Network.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const [route, text, name] of [['/', 'Barangay Contact Information', 'production-public-mobile'], ['/staff', 'Staff sign in', 'production-staff-mobile']]) {
    await call('Page.navigate', { url: origin + route });
    await waitFor(`document.body.textContent.includes(${JSON.stringify(text)})`);
    await waitFor(`Array.from(document.images).filter(image=>image.getBoundingClientRect().top<844).every(image=>image.complete)`);
    assert.ok(await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), `${route} must fit a 320px screen`);
    if (route === '/staff') assert.ok(await evaluate(`!!document.querySelector('input[type="email"]') && !!document.querySelector('input[type="password"]')`));
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
    console.log(`PASS: ${route} renders correctly on the live site at 320px`);
  }
  await call('Page.navigate',{url:origin+'/#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email'});
  await waitFor(`document.querySelector('[aria-label="Email confirmation"]')?.textContent.includes('other inbox')&&window.location.hash===''`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Dismiss message').click()`);
  await call('Page.reload');
  await waitFor(`performance.getEntriesByType('navigation')[0]?.type==='reload'&&document.body.textContent.includes('Barangay Contact Information')`);
  assert.ok(await evaluate(`!document.querySelector('[aria-label="Email confirmation"]')`),'Dismissed email feedback must stay cleared after refresh');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='SIGN IN / REGISTER').click()`);
  await waitFor(`document.querySelector('input[autocomplete="current-password"]')`);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Back to public site')`),'Resident sign-in must link back to the public landing page');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Back to public site').click()`);
  await waitFor(`document.body.textContent.includes('Barangay services, made easier.')`);
  console.log('PASS: Live email feedback stays dismissed after refresh; resident sign-in returns to the landing page.');
  assert.deepEqual(exceptions, [], 'Published pages must have no uncaught JavaScript errors');
  assert.deepEqual(apiFailures, [], 'Live public Supabase calls must succeed');
  assert.ok(!loadedJs.some(url=>/\/(charts-|AdminPage-|BookPage-)/.test(url)),'Public and staff sign-in pages must not download portal or chart bundles');
  console.log('PASS: No uncaught JavaScript errors or failed public Supabase responses. No forms were submitted.');
} finally {
  socket?.close(); chrome.kill();
}
