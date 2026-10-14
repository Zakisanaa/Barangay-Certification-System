import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Provisioning is restricted to the project's server-side service key.
// The browser cannot access this endpoint or retrieve its signing secret.
Deno.serve(async request => {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!url || !serviceKey || !resendKey) return Response.json({ error: "Email integration is not configured." }, { status: 503 });
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Server administrator access required." }, { status: 403 });
  // Supabase can translate API keys at the gateway. Confirm the caller's
  // database privileges instead of comparing translated credential strings.
  const access = await fetch(`${url}/rest/v1/delivery_tracking_settings?select=id&limit=0`, {
    headers: { apikey: serviceKey, Authorization: authorization }, signal: AbortSignal.timeout(20000),
  });
  if (!access.ok) return Response.json({ error: "Server administrator access required." }, { status: 403 });
  const endpoint = `${url.replace(/\/$/, "")}/functions/v1/resend-webhook`;
  const manualSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (manualSecret) {
    try {
      const id = crypto.randomUUID(); const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({ type: "setup.check", created_at: new Date().toISOString(), data: {} });
      const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(manualSecret.replace(/^whsec_/, "")), char => char.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`)));
      const encoded = btoa(String.fromCharCode(...signature));
      const check = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${encoded}` }, body: payload, signal: AbortSignal.timeout(20000) });
      if (!check.ok) return Response.json({ error: "The signing secret is present, but the delivery endpoint did not accept its signed check." }, { status: 502 });
      return Response.json({ configured: true, endpoint, source: "Supabase signing secret", signedCheckPassed: true });
    } catch { return Response.json({ error: "Could not verify the manually configured signing secret." }, { status: 502 }); }
  }
  const headers = { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" };
  const events = ["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.failed"];
  try {
    const listing = await fetch("https://api.resend.com/webhooks", { headers, signal: AbortSignal.timeout(20000) });
    if (!listing.ok) return Response.json({ error: "The existing Resend key cannot manage webhooks. Enable webhook access for that key, or configure the webhook in the Resend dashboard." }, { status: listing.status === 403 ? 403 : 502 });
    const listed = await listing.json() as { data?: { id: string; endpoint: string; status?: string }[] };
    const previous = listed.data?.find(webhook => webhook.endpoint === endpoint);
    const response = await fetch(previous ? `https://api.resend.com/webhooks/${previous.id}` : "https://api.resend.com/webhooks", {
      method: previous ? "GET" : "POST", headers,
      ...(previous ? {} : { body: JSON.stringify({ endpoint, events }) }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return Response.json({ error: "Could not configure the Resend delivery webhook." }, { status: 502 });
    const webhook = await response.json() as { id?: string; signing_secret?: string; status?: string };
    if (!webhook.id || !webhook.signing_secret?.startsWith("whsec_")) return Response.json({ error: "Resend did not provide a webhook signing secret." }, { status: 502 });
    if (webhook.status === "disabled") return Response.json({ error: "Enable the existing delivery webhook in the Resend dashboard, then run this setup again." }, { status: 409 });
    const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.from("delivery_tracking_settings").upsert({ id: 1, webhook_id: webhook.id, signing_secret: webhook.signing_secret, endpoint });
    if (error) return Response.json({ error: "The webhook exists, but its signing secret could not be saved. Run this setup again." }, { status: 500 });
    return Response.json({ configured: true, endpoint });
  } catch { return Response.json({ error: "The provider connection timed out. Run this setup again." }, { status: 502 }); }
});
