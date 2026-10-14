import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhook } from '../supabase/functions/resend-webhook/verify.ts';
import { getServiceFaq } from '../src/app/serviceFaq.ts';

test('webhook verifier accepts the published Svix example and rejects altered payloads', async () => {
  const headers = new Headers({ 'svix-id': 'msg_loFOjxBNrRLzqYUf', 'svix-timestamp': '1731705121', 'svix-signature': 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=' });
  const body = '{"event_type":"ping","data":{"success":true}}';
  const now = 1731705121 * 1000;
  assert.equal(await verifyWebhook(body, headers, 'whsec_plJ3nmyCDGBKInavdOK15jsl', now), true);
  assert.equal(await verifyWebhook(body + ' ', headers, 'whsec_plJ3nmyCDGBKInavdOK15jsl', now), false);
  assert.equal(await verifyWebhook(body, headers, 'whsec_plJ3nmyCDGBKInavdOK15jsl', now + 301000), false);
  assert.equal(await verifyWebhook(body, headers, 'whsec_invalid', now), false);
});

test('webhook verification supports key rotation and rejects future timestamps', async () => {
  const secret = Buffer.from('test signing key').toString('base64');
  const body = '{"type":"email.delivered"}';
  const now = Date.now(); const timestamp = Math.floor(now / 1000).toString();
  const signature = createHmac('sha256', Buffer.from(secret, 'base64')).update(`event-id.${timestamp}.${body}`).digest('base64');
  const headers = new Headers({ 'svix-id': 'event-id', 'svix-timestamp': timestamp, 'svix-signature': `v1,aW52YWxpZA== v1,${signature}` });
  assert.equal(await verifyWebhook(body, headers, `whsec_${secret}`, now), true);
  headers.set('svix-timestamp', String(Number(timestamp) + 600));
  assert.equal(await verifyWebhook(body, headers, `whsec_${secret}`, now), false);
});

test('FAQ uses staff information and does not invent missing fees or requirements', () => {
  const config = { services: [{ request_type: 'Barangay Clearance', active: true, requirements: '', fee_description: '', processing_time: '', softcopy_available: true }], office: { contact_number: '09931411699', contact_email: 'barangaylagasit00@gmail.com', address: 'Lagasit', office_hours: '' } };
  assert.match(getServiceFaq('Clearance requirements', config), /Not yet confirmed/);
  assert.doesNotMatch(getServiceFaq('Clearance requirements', config), /50\.00|2×2/);
  config.services[0].fee_description = 'Confirmed fee: PHP 75';
  assert.match(getServiceFaq('fees', config), /PHP 75/);
  assert.match(getServiceFaq('contact', config), /09931411699/);
  assert.match(getServiceFaq('reschedule', config), /request conversation/);
});
