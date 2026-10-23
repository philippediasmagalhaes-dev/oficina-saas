import { applyWhatsAppWebhook, verifyWebhookChallenge } from "../../../../server/whatsapp";

function bytesToHex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

async function validSignature(body: string, signature: string | null, secret: string | undefined) {
  if (!signature || !secret || !signature.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = `sha256=${bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))}`;
  if (expected.length !== signature.length) return false;
  let mismatch = 0; for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return mismatch === 0;
}

export async function GET(request: Request) {
  const result = verifyWebhookChallenge(new URL(request.url), process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  return result.ok ? new Response(result.challenge) : new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!await validSignature(body, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) return new Response("Forbidden", { status: 403 });
  try { await applyWhatsAppWebhook(JSON.parse(body)); } catch { return new Response("Invalid payload", { status: 400 }); }
  return new Response("EVENT_RECEIVED");
}
