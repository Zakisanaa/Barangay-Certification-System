import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const projectRef = (await fs.readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error('Link the Supabase project before running setup.');
// Capture the CLI response in memory. Never log or persist the server keys.
let stdout;
try {
  ({ stdout } = await exec(process.execPath, ['node_modules/supabase/dist/supabase.js', 'projects', 'api-keys', '--project-ref', projectRef, '--output', 'json'], { windowsHide: true, maxBuffer: 1024 * 1024 }));
} catch { throw new Error('Could not retrieve the project server key. Check the Supabase CLI login.'); }
let response;
try { response = JSON.parse(stdout); } catch { throw new Error('The CLI key response was not valid JSON. No keys were displayed.'); }
const keys = Array.isArray(response) ? response : response.api_keys ?? response.apiKeys ?? response.keys ?? response.data;
const serviceKey = keys?.find(key => key.name === 'service_role')?.api_key;
if (!serviceKey) throw new Error('The CLI did not return a server service key. Use the linked project administrator account.');
const result = await fetch(`https://${projectRef}.supabase.co/functions/v1/configure-delivery-tracking`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(60000) });
const payload = await result.json();
if (!result.ok || !payload.configured) throw new Error(payload.error ?? 'Delivery tracking could not be configured.');
console.log('Delivery tracking configured:', payload.endpoint);
