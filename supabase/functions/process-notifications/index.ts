import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendQueuedNotification } from "./send.ts";
import type { QueuedNotification } from "./send.ts";

Deno.serve(async request => {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !key) return Response.json({ error: "Maintenance is not configured." }, { status: 503 });
  if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Server administrator access required." }, { status: 403 });
  const caller = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const permission = await caller.rpc("notification_worker_access");
  if (permission.error || permission.data !== true) return Response.json({ error: "Server administrator access required." }, { status: 403 });
  const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    let input: { dry_run?: boolean };
    try { input = await request.json(); }
    catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
    const apiKey = Deno.env.get("RESEND_API_KEY"), sender = Deno.env.get("RESEND_FROM_EMAIL");
    if (input?.dry_run === true) {
      const queue = await server.from("notification_outbox").select("id", { count: "exact", head: true }).in("status", ["pending", "retry", "sending"]);
      const orphans = await server.rpc("orphan_school_id_paths");
      if (queue.error || orphans.error) throw new Error("Could not verify maintenance database access.");
      return Response.json({ ready: true, emailConfigured: !!apiKey && !!sender, queued: queue.count, orphanCandidates: orphans.data.length });
    }
    const warnings: string[] = [];
    const expired = await server.rpc("expire_overdue_appointments");
    if (expired.error) warnings.push("Could not expire overdue appointments.");
    const orphans = await server.rpc("orphan_school_id_paths");
    if (orphans.error) warnings.push("Could not check unused School ID uploads.");
    const paths = ((orphans.data ?? []) as { path: string }[]).map(item => item.path);
    let cleaned = 0;
    if (paths.length) {
      const cleanup = await server.storage.from("resident-school-ids").remove(paths);
      if (cleanup.error) warnings.push("Could not clean up unused School ID uploads.");
      else cleaned = paths.length;
    }
    if (!apiKey || !sender) return Response.json({ expired: expired.data, cleaned, sent: 0, emailConfigured: false, warnings }, { status: 503 });
    const claimed = await server.rpc("claim_notifications", { p_sender: sender, p_limit: 5 });
    if (claimed.error) throw new Error("Could not claim queued notifications.");
    let sent = 0, retrying = 0;
    for (const job of claimed.data as QueuedNotification[]) {
      const result = await sendQueuedNotification(job, apiKey);
      const finished = await server.rpc("finish_notification", { p_id: job.id, p_lease: job.lease_token, p_provider_id: result.providerId, p_error: result.error });
      if (finished.error || finished.data !== true) throw new Error("Could not record the notification result. Its saved attempt will be recovered automatically.");
      if (result.providerId) sent++; else retrying++;
    }
    return Response.json({ expired: expired.data, cleaned, sent, retrying, emailConfigured: true, warnings }, { status: warnings.length ? 503 : 200 });
  } catch (cause) {
    console.error("Background maintenance failed.", cause instanceof Error ? cause.message : "Unexpected failure");
    return Response.json({ error: cause instanceof Error ? cause.message : "Maintenance failed." }, { status: 503 });
  }
});
