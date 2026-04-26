import { Hono } from "hono";
import type { Env, HealthStatus } from "@/types";

const health = new Hono<{ Bindings: Env }>();

const startTime = Date.now();

health.get("/", (c) => {
  const status: HealthStatus = {
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: c.env.ENVIRONMENT,
    version: c.env.API_VERSION,
    checks: {
      worker: "ok",
      // db: await checkD1(c.env.DB),
    },
  };

  return c.json({ success: true, data: status });
});

export { health };
