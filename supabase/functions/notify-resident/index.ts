import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NotificationInput =
  | { type: "appointment_status"; reference: string; status: string }
  | { type: "concern_status"; reference: string; status: string }
  | { type: "staff_reply"; reference: string; message: string };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const senderEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const appSiteUrl = Deno.env.get("APP_SITE_URL")?.replace(/\/+$/, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey || !senderEmail) {
    console.error("Notification function is missing required secrets.");
    return jsonResponse({ error: "Email notifications are not configured on the server." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Sign in as staff to send notifications." }, 401);

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Your session is invalid or expired." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: staff, error: staffError } = await adminClient
    .from("resident_profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (staffError || staff?.role !== "staff") return jsonResponse({ error: "Only authorized staff can send resident notifications." }, 403);

  let input: NotificationInput;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (!input || typeof input !== "object" || !("reference" in input) ||
      typeof input.reference !== "string" || input.reference.trim().length === 0) {
    return jsonResponse({ error: "A valid record reference is required." }, 400);
  }

  let ownerId: string;
  let subject: string;
  let heading: string;
  let details: string;
  let text: string;

  if (input.type === "appointment_status") {
    const validStatuses = ["PENDING", "APPROVED", "COMPLETED", "REJECTED"];
    if (!validStatuses.includes(input.status)) return jsonResponse({ error: "Invalid appointment status." }, 400);
    const { data, error } = await adminClient
      .from("appointment_requests")
      .select("owner_id, status, request_type")
      .eq("reference", input.reference)
      .single();
    if (error) return jsonResponse({ error: "Could not find the appointment request." }, 404);
    if (data.status !== input.status) return jsonResponse({ error: "The appointment status changed before notification could be sent." }, 409);
    ownerId = data.owner_id;
    subject = `Appointment update: ${input.reference}`;
    heading = "Your appointment request has been updated";
    details = `Request: ${escapeHtml(data.request_type)}<br>Status: ${escapeHtml(input.status.replace("_", " "))}`;
    text = `Your appointment request ${input.reference} (${data.request_type}) is now ${input.status.replace("_", " ")}.`;
  } else if (input.type === "concern_status") {
    const validStatuses = ["RECEIVED", "IN_REVIEW", "RESOLVED"];
    if (!validStatuses.includes(input.status)) return jsonResponse({ error: "Invalid concern status." }, 400);
    const { data, error } = await adminClient
      .from("resident_concerns")
      .select("owner_id, status, category")
      .eq("reference", input.reference)
      .single();
    if (error) return jsonResponse({ error: "Could not find the concern." }, 404);
    if (data.status !== input.status) return jsonResponse({ error: "The concern status changed before notification could be sent." }, 409);
    ownerId = data.owner_id;
    subject = `Concern update: ${input.reference}`;
    heading = "Your concern or feedback has been updated";
    details = `Category: ${escapeHtml(data.category)}<br>Status: ${escapeHtml(input.status.replace("_", " "))}`;
    text = `Your concern ${input.reference} (${data.category}) is now ${input.status.replace("_", " ")}.`;
  } else if (input.type === "staff_reply") {
    if (typeof input.message !== "string" || input.message.trim().length === 0 || input.message.length > 1000) {
      return jsonResponse({ error: "The staff reply must contain 1 to 1000 characters." }, 400);
    }
    const { data, error } = await adminClient
      .from("transaction_messages")
      .select("id, body")
      .eq("request_reference", input.reference)
      .eq("author_id", authData.user.id)
      .eq("author_role", "Staff")
      .eq("body", input.message)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return jsonResponse({ error: "Could not verify the saved staff reply." }, 403);
    const { data: appointment, error: appointmentError } = await adminClient
      .from("appointment_requests")
      .select("owner_id")
      .eq("reference", input.reference)
      .single();
    if (appointmentError || !appointment) return jsonResponse({ error: "Could not find the appointment request." }, 404);
    ownerId = appointment.owner_id;
    subject = `New message about request ${input.reference}`;
    heading = "The Barangay staff sent you a message";
    details = `<p>Request reference: ${escapeHtml(input.reference)}</p><blockquote style="border-left:3px solid #2d6947;padding-left:12px;color:#34483a">${escapeHtml(input.message)}</blockquote>`;
    text = `The Barangay staff sent you a message about request ${input.reference}:\n\n${input.message}`;
  } else {
    return jsonResponse({ error: "Unsupported notification type." }, 400);
  }

  const { data: resident, error: residentError } = await adminClient
    .from("resident_profiles")
    .select("email, first_name")
    .eq("id", ownerId)
    .single();
  if (residentError || !resident?.email) return jsonResponse({ error: "Could not find the resident email address." }, 404);

  const greeting = resident.first_name ? `Hello ${escapeHtml(resident.first_name)},` : "Hello,";
  const appLink = appSiteUrl
    ? `<p><a href="${escapeHtml(appSiteUrl)}" style="color:#123323">Sign in to the Barangay portal to view the update.</a></p>`
    : "<p>Sign in to the Barangay portal to view the update.</p>";
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: senderEmail,
      to: [resident.email],
      subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24362a"><h2 style="color:#123323">${heading}</h2><p>${greeting}</p>${details}${appLink}<p>Barangay Lagasit Portal</p></div>`,
      text: `${heading}\n\n${text}\n\nSign in to the Barangay portal to view the update.`,
    }),
  });
  if (!emailResponse.ok) {
    const providerError = await emailResponse.text();
    console.error("Resend email delivery failed.", emailResponse.status, providerError);
    return jsonResponse({ error: "The update was saved, but Resend could not deliver the email. Check the Resend logs and sender configuration." }, 502);
  }

  return jsonResponse({ success: true });
});
