import type { Context, Next } from "hono";
import type { Env } from "@/types";

// ─── Security Headers Middleware ──────────────────────────────────────────────
export async function securityHeaders(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  await next();

  const isDev = c.env.ENVIRONMENT === "development";

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  c.header(
    "Content-Security-Policy",
    isDev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws: wss:;"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';"
  );
}

// ─── CORS Middleware ──────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://cf-stack.your-domain.com",
];

export async function corsMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const origin = c.req.header("Origin") ?? "";
  const isAllowed =
    c.env.ENVIRONMENT === "development" || ALLOWED_ORIGINS.includes(origin);

  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin : "",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,Authorization,X-Request-ID",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  await next();

  if (isAllowed) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
  }
}

// ─── Request ID Middleware ────────────────────────────────────────────────────
export async function requestId(c: Context, next: Next) {
  const id =
    c.req.header("X-Request-ID") ?? crypto.randomUUID();
  c.set("requestId", id);
  c.header("X-Request-ID", id);
  await next();
}

// ─── Simple In-Memory Rate Limiter ────────────────────────────────────────────
// For production, replace with Cloudflare Rate Limiting binding
const rateMap = new Map<string, { count: number; reset: number }>();

export function rateLimiter(limit: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("CF-Connecting-IP") ??
      c.req.header("X-Forwarded-For") ??
      "unknown";
    const now = Date.now();
    const record = rateMap.get(ip);

    if (!record || now > record.reset) {
      rateMap.set(ip, { count: 1, reset: now + windowMs });
    } else if (record.count >= limit) {
      return c.json(
        { success: false, error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((record.reset - now) / 1000)) } }
      );
    } else {
      record.count++;
    }

    await next();
  };
}

// ─── Logger Middleware ────────────────────────────────────────────────────────
export async function logger(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  await next();

  const ms = Date.now() - start;
  const status = c.res.status;
  const color =
    status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";

  console.log(`${color}${method}\x1b[0m ${path} ${status} ${ms}ms`);
}
