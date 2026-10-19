import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NotificationInput =
  | {type:"appointment_pdf_retry";reference:string;deliveryId:string}
  | { type: "appointment_status"; reference: string; status: string }
  | { type: "appointment_pdf"; reference: string; templateName: string; pdfBase64: string; deliveryId: string }
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
    .select("role, first_name, last_name")
    .eq("id", authData.user.id)
    .single();

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
  const permission = ['appointment_pdf','appointment_pdf_retry'].includes(input.type) ? 'certificates' : input.type === 'concern_status' ? 'concerns' : 'requests';
  const access = await authClient.rpc('has_staff_permission', { p_permission: permission });
  if (staffError || staff?.role !== 'staff' || access.error || access.data !== true) {
    return jsonResponse({ error: 'You do not have permission to send this notification.' }, 403);
  }

  const recovering=input.type==='appointment_pdf_retry';
  if(input.type==='appointment_pdf_retry'){
    if(typeof input.deliveryId!=='string'||!/^[0-9a-f-]{36}$/i.test(input.deliveryId))return jsonResponse({error:'Choose a saved delivery attempt.'},400);
    const saved=await adminClient.from('certificate_deliveries').select('*').eq('id',input.deliveryId).eq('request_reference',input.reference).maybeSingle();
    if(saved.error||!saved.data)return jsonResponse({error:'Saved certificate delivery not found.'},404);
    if(saved.data.provider_id){if(['bounced','failed'].includes(saved.data.status))return jsonResponse({error:'The previous email was rejected. Review delivery history before starting a new attempt.'},409);return jsonResponse({success:true,deliveryId:saved.data.id});}
    if(Date.now()-Date.parse(saved.data.created_at)>23*60*60*1000)return jsonResponse({error:'This attempt requires provider-log review before a new send. The safe retry period has expired.'},409);
    if(!saved.data.email_payload)return jsonResponse({error:'This older delivery has no saved email payload. Review the provider logs before starting another attempt.'},409);
    const file=await adminClient.storage.from('completed-certificates').download(saved.data.storage_path);
    if(file.error||!file.data)return jsonResponse({error:'The PDF was not saved. Reselect the original PDF to resume this delivery ID.'},409);
    const bytes=new Uint8Array(await file.data.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    input={type:'appointment_pdf',reference:input.reference,deliveryId:saved.data.id,templateName:saved.data.template_name,pdfBase64:btoa(binary)};
  }

  // Legacy clients may still request ordinary emails. The database already queued them atomically;
  // acknowledging here prevents a second send outside the durable outbox.
  if (["appointment_status", "concern_status", "staff_reply"].includes(input.type)) {
    return jsonResponse({ success: true, queued: true });
  }

  let ownerId: string;
  let subject: string;
  let heading: string;
  let details: string;
  let text: string;
  let attachments: { filename: string; content: string }[] | undefined;
  let savedCertificatePath: string | undefined;
  let deliveryId: string | undefined;
  let frozenPayload:Record<string,unknown>|null=null;

  if (input.type === "appointment_status") {
    const validStatuses = ["PENDING", "APPROVED", "COMPLETED", "REJECTED"];
    if (!validStatuses.includes(input.status)) return jsonResponse({ error: "Invalid appointment status." }, 400);
    const { data, error } = await adminClient
      .from("appointment_requests")
      .select("owner_id, status, request_type, rejection_reason")
      .eq("reference", input.reference)
      .single();
    if (error) return jsonResponse({ error: "Could not find the appointment request." }, 404);
    if (data.status !== input.status) return jsonResponse({ error: "The appointment status changed before notification could be sent." }, 409);
    ownerId = data.owner_id;
    subject = `Appointment update: ${input.reference}`;
    heading = "Your appointment request has been updated";
    details = `Request: ${escapeHtml(data.request_type)}<br>Status: ${escapeHtml(input.status.replace("_", " "))}`;
    text = `Your appointment request ${input.reference} (${data.request_type}) is now ${input.status.replace("_", " ")}.`;
    if (input.status === "REJECTED" && data.rejection_reason) {
      details += `<br>Reason: ${escapeHtml(data.rejection_reason)}`;
      text += ` Reason: ${data.rejection_reason}`;
    }
  } else if (input.type === "appointment_pdf") {
    if (typeof input.templateName !== "string" || typeof input.pdfBase64 !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(input.pdfBase64) ||
        input.pdfBase64.length > 7 * 1024 * 1024) {
      return jsonResponse({ error: "Choose a valid certificate template." }, 400);
    }
    const { data, error } = await adminClient
      .from("appointment_requests")
      .select("owner_id, request_type, delivery_format, status")
      .eq("reference", input.reference)
      .single();
    if (error) return jsonResponse({ error: "Could not find the appointment request." }, 404);
    if (data.delivery_format !== "Softcopy" && data.delivery_format !== "Both") {
      return jsonResponse({ error: "This resident did not request a softcopy." }, 409);
    }
    if (data.status !== "APPROVED" && data.status !== "COMPLETED") {
      return jsonResponse({ error: "Approve the request before sending its certificate." }, 409);
    }
    const template = await adminClient.from('certificate_templates').select('label,active')
      .eq('request_type', data.request_type).eq('storage_path', input.templateName).maybeSingle();
    if (template.error || !template.data) {
      return jsonResponse({ error: "The selected template does not match this request type." }, 400);
    }
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = Uint8Array.from(atob(input.pdfBase64), (character) => character.charCodeAt(0));
    } catch {
      return jsonResponse({ error: "The completed certificate is not valid base64 data." }, 400);
    }
    if (pdfBytes.length < 6 || pdfBytes.length > 5 * 1024 * 1024 ||
        new TextDecoder().decode(pdfBytes.subarray(0, 5)) !== "%PDF-") {
      return jsonResponse({ error: "Upload a valid completed PDF no larger than 5 MB." }, 400);
    }
    if (typeof input.deliveryId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.deliveryId)) {
      return jsonResponse({ error: "Choose the PDF again to start a valid delivery attempt." }, 400);
    }
    deliveryId = input.deliveryId;
    const { data: recipient, error: recipientError } = await adminClient.from("resident_profiles").select("email").eq("id", data.owner_id).single();
    if (recipientError || !recipient?.email) return jsonResponse({ error: "Could not find the resident email address." }, 404);
    const pdfHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(pdfBytes))), byte => byte.toString(16).padStart(2, "0")).join("");
    const { data: previous, error: previousError } = await adminClient.from("certificate_deliveries").select("*").eq("id", deliveryId).maybeSingle();
    if(!previous&&!template.data.active)return jsonResponse({error:'Choose the currently published template for a new certificate.'},409);
    if (previousError) return jsonResponse({ error: "Could not load certificate delivery history." }, 500);
    if (previous && (previous.pdf_hash !== pdfHash || previous.request_reference !== input.reference || previous.template_name !== input.templateName)) {
      return jsonResponse({ error: "This delivery attempt belongs to a different certificate. Choose the PDF again." }, 409);
    }
    frozenPayload=previous?.email_payload??null;
    if (previous?.provider_id) {
      if (previous.status === "bounced" || previous.status === "failed") return jsonResponse({ error: "The previous email could not be delivered. Review the resident email and choose the PDF again for a new send." }, 409);
      return jsonResponse({ success: true, savedCertificatePath: previous.storage_path, deliveryId });
    }
    if (previous && Date.now() - Date.parse(previous.created_at) > 23 * 60 * 60 * 1000) {
      return jsonResponse({ error: "This delivery attempt has expired. Check request history and choose the PDF again before resending." }, 409);
    }
    const templateLabel = template.data?.label??"Certificate";
    ownerId = data.owner_id;
    const safeReference = input.reference.replace(/[^A-Za-z0-9-]+/g, "-");
    savedCertificatePath = `${ownerId}/${safeReference}/${deliveryId}.pdf`;
    if (!previous) {
      const { error: historyError } = await adminClient.from("certificate_deliveries").insert({
        id: deliveryId, request_reference: input.reference, owner_id: ownerId,
        sent_by: authData.user.id, sender_name: `${staff.first_name} ${staff.last_name}`.trim(),
        recipient_email: recipient.email, template_name: input.templateName, storage_path: savedCertificatePath, pdf_hash: pdfHash,
      });
      if (historyError) return jsonResponse({ error: "Could not create delivery history. Retry the same PDF." }, 500);
    }
    const { error: storageError } = await adminClient.storage
      .from("completed-certificates")
      .upload(savedCertificatePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (storageError) {
      console.error("Unable to save the completed certificate PDF.", storageError);
      await adminClient.from("certificate_deliveries").update({ status: "failed", error_message: "Could not save the PDF. Retry this attempt.", updated_at: new Date().toISOString() }).eq("id", deliveryId);
      return jsonResponse({ error: "Could not save the completed PDF in the private certificate archive." }, 500);
    }
    const { error: preparingError } = await adminClient.from("certificate_deliveries").update({ status: "pending", error_message: null, updated_at: new Date().toISOString() }).eq("id", deliveryId).is("provider_id", null);
    if (preparingError) return jsonResponse({ error: "The PDF was saved, but its delivery attempt could not be prepared. Retry this same PDF." }, 500);
    subject = `Completed certificate: ${input.reference}`;
    heading = "Your completed certificate";
    details = `Attached is the completed ${escapeHtml(templateLabel)} PDF for request ${escapeHtml(input.reference)}. The editable DOCX template is not attached.`;
    text = `Attached is the completed ${templateLabel} PDF for request ${input.reference}. The editable DOCX template is not attached.`;
    attachments = [{
      filename: `${input.reference}-${templateLabel.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`,
      content: input.pdfBase64,
    }];
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
  const appLink = attachments
    ? ""
    : appSiteUrl
      ? `<p><a href="${escapeHtml(appSiteUrl)}" style="color:#123323">Sign in to the Barangay portal to view the update.</a></p>`
      : "<p>Sign in to the Barangay portal to view the update.</p>";
  const proposedPayload={
      from: senderEmail,
      to: [resident.email],
      subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24362a"><h2 style="color:#123323">${heading}</h2><p>${greeting}</p>${details}${appLink}<p>Barangay Lagasit Portal</p></div>`,
      text: `${heading}\n\n${text}${attachments ? "" : "\n\nSign in to the Barangay portal to view the update."}`,
      ...(attachments ? { attachments } : {}),
      ...(deliveryId ? { tags: [{ name: "delivery_id", value: deliveryId }] } : {}),
    };
  if(deliveryId&&!frozenPayload){
    const stored=await adminClient.from('certificate_deliveries').update({email_payload:proposedPayload}).eq('id',deliveryId).is('email_payload',null);
    if(stored.error)return jsonResponse({error:'Could not preserve this delivery attempt. Retry the same PDF.'},500);
    const current=await adminClient.from('certificate_deliveries').select('email_payload').eq('id',deliveryId).single();
    if(current.error||!current.data?.email_payload)return jsonResponse({error:'Could not confirm the saved email. Retry the same PDF.'},500);
    frozenPayload=current.data.email_payload;
  }
  let emailResponse: Response;
  try {
    emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      ...(deliveryId ? { "Idempotency-Key": `certificate/${deliveryId}` } : {}),
    },
    body: JSON.stringify(frozenPayload??proposedPayload),
  });
  } catch {
    if (deliveryId) await adminClient.from("certificate_deliveries").update({ error_message: "Could not confirm the email provider response. Retry this same PDF to recover the sending status.", updated_at: new Date().toISOString() }).eq("id", deliveryId);
    return jsonResponse({ error: "Could not confirm the email provider response. Retry the same PDF; duplicate delivery attempts are protected." }, 502);
  }
  if (!emailResponse.ok) {
    const providerError = await emailResponse.text();
    console.error("Resend email delivery failed.", emailResponse.status, providerError);
    if (deliveryId) await adminClient.from("certificate_deliveries").update({ status: "failed", error_message: "The PDF was saved, but the email provider did not accept it. Retry sending.", updated_at: new Date().toISOString() }).eq("id", deliveryId);
    return jsonResponse({
      error: attachments
        ? "The PDF was saved in the private certificate archive, but it could not be emailed. Retry sending or check the Resend logs and sender configuration."
        : "Resend could not deliver the email. Check the Resend logs and sender configuration.",
    }, 502);
  }

  if (deliveryId) {
    const provider = await emailResponse.json() as { id?: string };
    if (!provider.id) return jsonResponse({ error: "The email provider response was incomplete. Retry the same PDF to check its status." }, 502);
    const { error: historyError } = await adminClient.from("certificate_deliveries").update({
      provider_id: provider.id, status: "sent", error_message: null, updated_at: new Date().toISOString(),
    }).eq("id", deliveryId).is("last_event_at", null);
    if (historyError) return jsonResponse({ error: "The provider accepted the email, but delivery history could not be updated. Retry the same PDF to recover its status." }, 500);
  }

  return jsonResponse({ success: true, ...(savedCertificatePath ? { savedCertificatePath, deliveryId } : {}) });
});
