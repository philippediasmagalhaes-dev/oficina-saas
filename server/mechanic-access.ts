type MechanicGrant = { workshopId: string; serviceRecordId: string; expiresAt: number; nonce: string };

async function key(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(`mechanic-v1:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signMechanicAccess(input: Pick<MechanicGrant, "workshopId" | "serviceRecordId">, secret: string, now = Date.now()) {
  const grant: MechanicGrant = { ...input, expiresAt: now + 8 * 3600000, nonce: crypto.randomUUID() };
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  const signature = await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(payload));
  return `${payload}.${Buffer.from(signature).toString("base64url")}`;
}

export async function verifyMechanicAccess(token: string, secret: string, now = Date.now()): Promise<MechanicGrant | null> {
  try {
    if (!secret || token.length > 1024) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    if (!await crypto.subtle.verify("HMAC", await key(secret), Buffer.from(signature, "base64url"), new TextEncoder().encode(payload))) return null;
    const grant = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as MechanicGrant;
    if (!grant.workshopId || !grant.serviceRecordId || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= now || grant.expiresAt > now + 8 * 3600000) return null;
    return grant;
  } catch { return null; }
}
