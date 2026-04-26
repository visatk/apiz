import { Hono } from "hono";
import type { Env } from "@/types";
import { signJwt, verifyJwt } from "../middleware/auth.js";

const auth = new Hono<{ Bindings: Env }>();

// POST /api/v1/auth/login
auth.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return c.json({ success: false, error: "Email and password required" }, 400);
  }

  // ── TODO: Replace with real DB lookup ──────────────────────────────────────
  // const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
  //   .bind(body.email).first();
  // const valid = await verifyPassword(body.password, user.password_hash);

  const isValid = body.email === "demo@cf-stack.dev" && body.password === "demo1234";
  if (!isValid) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  const secret = (c.env as unknown as Record<string, string>)["JWT_SECRET"] ?? "change-me-in-production";
  const token = await signJwt(
    { sub: "user_1", email: body.email, role: "user" },
    secret,
    60 * 60 * 24 // 24h
  );

  return c.json({
    success: true,
    data: { token, expiresIn: 86400 },
  });
});

// POST /api/v1/auth/refresh
auth.post("/refresh", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Token required" }, 401);
  }

  const secret = (c.env as unknown as Record<string, string>)["JWT_SECRET"] ?? "change-me-in-production";
  const payload = await verifyJwt(authHeader.slice(7), secret);
  if (!payload) {
    return c.json({ success: false, error: "Invalid token" }, 401);
  }

  const newToken = await signJwt(
    { sub: payload.sub, email: payload.email, role: payload.role },
    secret,
    86400
  );

  return c.json({ success: true, data: { token: newToken, expiresIn: 86400 } });
});

export { auth };
