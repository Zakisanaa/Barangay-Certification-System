import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyWebhook } from "./verify.ts";

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Webhook is not configured", { status: 503 });
  if (!request.headers.get("svix-id") || !request.headers.get("svix-timestamp") || !request.headers.get("svix-signature")) return new Response("Invalid signature", { status: 401 });
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!secret) {
    const { data, error } = await client.from("delivery_tracking_settings").select("signing_secret").eq("id", 1).single();
    if (error || !data?.signing_secret) return new Response("Webhook is not configured", { status: 503 });
    secret = data.signing_secret;
  }
  if (!secret) return new Response("Webhook is not configured", { status: 503 });
  const payload = await request.text();
  if (!await verifyWebhook(payload, request.headers, secret)) return new Response("Invalid signature", { status: 401 });
  let event: { type: string; created_at: string; data: { email_id?: string; tags?: Record<string, string> } };
  try { event = JSON.parse(payload); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const statuses: Record<string, string> = {
    "email.sent": "sent", "email.delivered": "delivered", "email.delivery_delayed": "delayed",
    "email.bounced": "bounced", "email.failed": "failed",
  };
  const status = statuses[event.type];
  if (!status) return new Response("Ignored", { status: 200 });
  const deliveryId = event.data?.tags?.delivery_id;
  if (!deliveryId) return new Response("Untracked email", { status: 200 });
  if (!event.data?.email_id || !event.created_at || Number.isNaN(Date.parse(event.created_at))) return new Response("Invalid event", { status: 400 });
  const { error: linkError } = await client.from("certificate_deliveries").update({ provider_id: event.data.email_id }).eq("id", deliveryId).is("provider_id", null);
  if (linkError) return new Response("Delivery record not ready; retry", { status: 503 });
  const { data, error } = await client.rpc("apply_email_event", {
    p_event_id: request.headers.get("svix-id"), p_email_id: event.data.email_id,
    p_next_status: status, p_event_time: event.created_at,
  });
  // The provider may deliver a webhook before the send response has been saved.
  // A temporary failure asks Resend to retry instead of dropping that event.
  if (error || !data) return new Response("Delivery record not ready; retry", { status: 503 });
  return new Response("Recorded", { status: 200 });
});
