import type { Context, Next } from "hono";
import type { Env, JwtPayload } from "@/types";

// ─── JWT Helper (using Web Crypto API — no Node deps needed) ─────────────────
export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signingInput = `${headerB64}.${payloadB64}`;
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig,
      encoder.encode(signingInput)
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp">,
  secret: string,
  expiresInSec = 3600
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSec })
  );
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.${sigB64}`;
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
export function requireAuth(roles?: JwtPayload["role"][]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const secret = (c.env as unknown as Record<string, string>)["JWT_SECRET"] ?? "change-me-in-production";
    const payload = await verifyJwt(token, secret);

    if (!payload) {
      return c.json({ success: false, error: "Invalid or expired token" }, 401);
    }

    if (roles && !roles.includes(payload.role)) {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }

    c.set("user", payload);
    await next();
  };
}
