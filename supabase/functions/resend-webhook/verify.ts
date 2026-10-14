export async function verifyWebhook(payload: string, headers: Headers, secret: string, now = Date.now()): Promise<boolean> {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  try {
    const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), char => char.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const message = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
    for (const candidate of signature.split(" ")) {
      const [version, encoded] = candidate.split(",");
      if (version !== "v1" || !encoded) continue;
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      if (await crypto.subtle.verify("HMAC", key, bytes, message)) return true;
    }
  } catch { return false; }
  return false;
}
