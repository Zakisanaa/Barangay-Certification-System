export interface QueuedNotification {
  id: string;
  lease_token: string;
  send_payload: { from: string; to: string[]; subject: string; text: string };
}

// The payload is frozen in Postgres on the first claim; retries must send exactly the same request.
export async function sendQueuedNotification(job: QueuedNotification, apiKey: string, request: typeof fetch = fetch): Promise<{ providerId: string | null; error: string | null }> {
  try {
    const response = await request("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `notification/${job.id}` },
      body: JSON.stringify(job.send_payload),
    });
    if (!response.ok) return { providerId: null, error: `Email provider returned HTTP ${response.status}. Review the sender settings or retry later.` };
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string" || !result.id) return { providerId: null, error: "The provider response did not confirm an email ID. The same notification will be retried safely." };
    return { providerId: result.id, error: null };
  } catch {
    return { providerId: null, error: "The email response could not be confirmed. The same notification will be retried safely." };
  }
}
