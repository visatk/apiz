import { Hono } from "hono";
import type { Env } from "./types/index";
import {
  securityHeaders,
  corsMiddleware,
  requestId,
  rateLimiter,
  logger,
} from "./api/middleware/security";
import { health } from "./api/routes/health";
import { auth } from "./api/routes/auth";
import { items } from "./api/routes/items";

// ─── App ──────────────────────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use("*", logger);
app.use("*", requestId);
app.use("*", corsMiddleware);
app.use("*", securityHeaders);
app.use("/api/*", rateLimiter(100, 60_000)); // 100 req/min per IP on API routes

// ─── Routes ───────────────────────────────────────────────────────────────────
const v1 = new Hono<{ Bindings: Env }>();

v1.route("/health", health);
v1.route("/auth", auth);
v1.route("/items", items);

app.route("/api/v1", v1);

// ─── 404 fallback for API ────────────────────────────────────────────────────
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ success: false, error: "Route not found" }, 404);
  }
  // All other requests → serve React SPA via ASSETS binding
  return c.env.ASSETS.fetch(c.req.raw);
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error("[Worker Error]", err);
  const isDev = c.env.ENVIRONMENT === "development";
  return c.json(
    {
      success: false,
      error: "Internal server error",
      ...(isDev && { detail: err.message, stack: err.stack }),
    },
    500
  );
});

export default app;
