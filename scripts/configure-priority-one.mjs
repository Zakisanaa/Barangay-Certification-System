import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const projectRef = (await fs.readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error('Link the intended Supabase project before setup.');
let stdout;
try {
  ({ stdout } = await exec(process.execPath, ['node_modules/supabase/dist/supabase.js', 'projects', 'api-keys', '--project-ref', projectRef, '--output', 'json'], { windowsHide: true, maxBuffer: 1024 * 1024 }));
} catch { throw new Error('Could not retrieve the project server key. Check the Supabase CLI login.'); }
let payload;
try { payload = JSON.parse(stdout); }
catch { throw new Error('The CLI returned an unexpected response. No credentials were displayed.'); }
const keys = Array.isArray(payload) ? payload : payload.api_keys ?? payload.apiKeys ?? payload.keys ?? payload.data;
const serverKey = keys?.find(key => key.name === 'service_role')?.api_key;
const anonKey = keys?.find(key => key.name === 'anon')?.api_key;
if (!serverKey || !anonKey) throw new Error('The linked project legacy service-role and anon JWTs are required.');
const origin = `https://${projectRef}.supabase.co`;
async function call(path, key, body) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  return { response, data: await response.json() };
}
const configured = await call('/rest/v1/rpc/configure_barangay_maintenance', serverKey, { p_project_url: origin, p_worker_key: serverKey });
if (!configured.response.ok || configured.data !== true) throw new Error(`Maintenance configuration failed (${configured.response.status}). Check the deployed migration. No credentials were displayed.`);
const checked = await call('/functions/v1/process-notifications', serverKey, { dry_run: true });
if (!checked.response.ok || checked.data.ready !== true || !checked.data.emailConfigured) throw new Error('The maintenance worker is not ready. Check its deployment and Resend secrets.');
const forbidden = await call('/functions/v1/process-notifications', anonKey, { dry_run: true });
if (forbidden.response.status !== 403) throw new Error('The maintenance worker did not reject an anonymous caller.');
console.log(JSON.stringify({ project: projectRef, configured: true, emailConfigured: checked.data.emailConfigured, queued: checked.data.queued, orphanCandidates: checked.data.orphanCandidates, anonymousAccessBlocked: true, verification: 'Read-only; no test emails or appointment changes.' }, null, 2));
