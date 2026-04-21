import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { getConfig } from "@news/config";
import { bookmarks, createDb, ensureCoreSchema, users } from "@news/database";
import { createLogger } from "@news/observability";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { z } from "zod";

const config = getConfig();
const logger = createLogger("user-service");
const app = Fastify({ loggerInstance: logger });
await ensureCoreSchema(config.POSTGRES_URL);
const db = createDb(config.POSTGRES_URL);
const port = Number(process.env.PORT ?? "3000");

await app.register(cors, { origin: true });
await app.register(helmet);

app.get("/health", async () => ({
  status: "ok",
  service: "user-service"
}));

app.post("/users", async (request) => {
  const payload = z.object({
    email: z.string().email(),
    preferences: z.record(z.any()).optional()
  }).parse(request.body);

  const existing = await db.select().from(users).where(eq(users.email, payload.email)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }

  const [user] = await db
    .insert(users)
    .values({
      email: payload.email,
      preferences: payload.preferences ?? {}
    })
    .returning();

  return user;
});

app.get("/users/:id/bookmarks", async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  return db.select().from(bookmarks).where(eq(bookmarks.userId, params.id));
});

app.post("/bookmark", async (request) => {
  const body = z.object({
    userId: z.string().uuid(),
    articleId: z.string().uuid()
  }).parse(request.body);

  const [bookmark] = await db
    .insert(bookmarks)
    .values(body)
    .onConflictDoNothing()
    .returning();

  return {
    success: true,
    bookmark: bookmark ?? body
  };
});

await app.listen({
  host: "0.0.0.0",
  port
});
