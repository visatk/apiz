import { Hono } from "hono";
import type { Env } from "@/types";
import { requireAuth } from "../middleware/auth.js";

interface Item {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  userId: string;
}

// In-memory store — replace with D1 queries
const store = new Map<string, Item>();

const items = new Hono<{ Bindings: Env }>();

// All item routes require auth
items.use("*", requireAuth());

// GET /api/v1/items
items.get("/", (c) => {
  const user = c.get("user") as { sub: string };
  const userItems = [...store.values()].filter((i) => i.userId === user.sub);
  return c.json({
    success: true,
    data: userItems,
    meta: { timestamp: new Date().toISOString(), version: c.env.API_VERSION, requestId: c.get("requestId") as string },
  });
});

// GET /api/v1/items/:id
items.get("/:id", (c) => {
  const item = store.get(c.req.param("id"));
  if (!item) return c.json({ success: false, error: "Not found" }, 404);
  return c.json({ success: true, data: item });
});

// POST /api/v1/items
items.post("/", async (c) => {
  const user = c.get("user") as { sub: string };
  const body = await c.req.json<{ name: string; description?: string }>();

  if (!body.name?.trim()) {
    return c.json({ success: false, error: "Name is required" }, 400);
  }

  const item: Item = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    description: body.description?.trim(),
    createdAt: new Date().toISOString(),
    userId: user.sub,
  };

  store.set(item.id, item);
  return c.json({ success: true, data: item }, 201);
});

// PATCH /api/v1/items/:id
items.patch("/:id", async (c) => {
  const item = store.get(c.req.param("id"));
  if (!item) return c.json({ success: false, error: "Not found" }, 404);

  const body = await c.req.json<Partial<Pick<Item, "name" | "description">>>();
  const updated = { ...item, ...body };
  store.set(item.id, updated);

  return c.json({ success: true, data: updated });
});

// DELETE /api/v1/items/:id
items.delete("/:id", (c) => {
  const existed = store.delete(c.req.param("id"));
  if (!existed) return c.json({ success: false, error: "Not found" }, 404);
  return c.json({ success: true, message: "Deleted" });
});

export { items };
