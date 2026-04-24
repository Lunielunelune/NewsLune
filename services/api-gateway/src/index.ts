import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { getConfig } from "@news/config";
import { createDb, ensureCoreSchema, articles } from "@news/database";
import { createLogger } from "@news/observability";
import { CircuitBreaker, createOptionalSearchClient, createRedisClient } from "@news/platform";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import Fastify from "fastify";
import { z } from "zod";

const config = getConfig();
const logger = createLogger("api-gateway");
const app = Fastify({ loggerInstance: logger });
await ensureCoreSchema(config.POSTGRES_URL);
const db = createDb(config.POSTGRES_URL);
const redis = createRedisClient();
const search = createOptionalSearchClient();
const userServiceBreaker = new CircuitBreaker(4, 15_000);
const port = Number(process.env.PORT ?? "3001");

await app.register(cors, { origin: true });
await app.register(helmet);
await app.register(sensible);

const listQuerySchema = z.object({
  category: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20)
});

app.get("/health", async () => ({
  status: "ok",
  service: "api-gateway",
  degraded: {
    search: search === null
  }
}));

app.get("/news", async (request) => {
  const query = listQuerySchema.parse(request.query);
  const cursorDate = query.cursor ? new Date(query.cursor) : undefined;

  const data = await db
    .select()
    .from(articles)
    .where(
      and(
        query.category ? eq(articles.category, query.category) : undefined,
        cursorDate ? sql`${articles.publishedAt} < ${cursorDate}` : undefined
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(query.limit + 1);

  const hasMore = data.length > query.limit;
  const items = hasMore ? data.slice(0, -1) : data;

  return {
    items,
    nextCursor: hasMore ? items.at(-1)?.publishedAt.toISOString() : null
  };
});

app.get("/news/:id", async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const [article] = await db.select().from(articles).where(eq(articles.id, params.id)).limit(1);

  if (!article) {
    return reply.notFound("Article not found");
  }

  return article;
});

app.get("/search", async (request) => {
  const query = z.object({ q: z.string().min(2) }).parse(request.query);
  if (!search) {
    const items = await db
      .select()
      .from(articles)
      .where(ilike(articles.title, `%${query.q}%`))
      .limit(20);

    return { items };
  }

  const result = await search.search({
    index: "articles",
    query: {
      multi_match: {
        query: query.q,
        fields: ["title^3", "description^2", "content", "summary", "keywords^2"]
      }
    },
    size: 20
  });

  return {
    items: result.hits.hits.map((hit) => ({
      id: hit._id,
      ...(hit._source ?? {})
    }))
  };
});

app.get("/categories", async () => {
  const result = await db
    .select({
      category: articles.category,
      count: sql<number>`count(*)::int`
    })
    .from(articles)
    .groupBy(articles.category)
    .orderBy(desc(sql`count(*)`));

  return { items: result };
});

app.get("/trending", async () => {
  const cached = await redis.get("trending:news");
  if (cached) {
    return JSON.parse(cached);
  }

  const items = await db.select().from(articles).orderBy(desc(articles.rankingScore)).limit(20);
  const payload = { items };
  await redis.set("trending:news", JSON.stringify(payload), "EX", 60);
  return payload;
});

app.post("/bookmark", async (request, reply) => {
  const body = z.object({
    userId: z.string().uuid(),
    articleId: z.string().uuid()
  }).parse(request.body);

  const response = await userServiceBreaker.run(() =>
    fetch(`${config.USER_SERVICE_URL}/bookmark`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    })
  );

  if (!response.ok) {
    return reply.code(response.status).send(await response.json());
  }

  return response.json();
});

app.post("/users", async (request, reply) => {
  const body = z.object({
    email: z.string().email(),
    preferences: z.record(z.any()).optional()
  }).parse(request.body);

  const response = await userServiceBreaker.run(() =>
    fetch(`${config.USER_SERVICE_URL}/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    })
  );

  if (!response.ok) {
    return reply.code(response.status).send(await response.json());
  }

  return response.json();
});

app.get("/users/:id/bookmarks", async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);

  const response = await userServiceBreaker.run(() =>
    fetch(`${config.USER_SERVICE_URL}/users/${params.id}/bookmarks`)
  );

  if (!response.ok) {
    return reply.code(response.status).send(await response.json());
  }

  const bookmarks = (await response.json()) as Array<{
    userId: string;
    articleId: string;
    createdAt: string;
  }>;

  if (bookmarks.length === 0) {
    return { items: [] };
  }

  const bookmarkOrder = new Map(
    bookmarks.map((bookmark) => [bookmark.articleId, new Date(bookmark.createdAt).getTime()])
  );

  const items = await db
    .select()
    .from(articles)
    .where(inArray(articles.id, bookmarks.map((bookmark) => bookmark.articleId)));

  items.sort((left, right) => {
    return (bookmarkOrder.get(right.id) ?? 0) - (bookmarkOrder.get(left.id) ?? 0);
  });

  return { items };
});

app.get("/news/stream", async (request, reply) => {
  const subscriber = createRedisClient();

  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.flushHeaders();

  await subscriber.subscribe("news-updates");

  const onMessage = (_channel: string, message: string) => {
    reply.raw.write(`event: news\n`);
    reply.raw.write(`data: ${message}\n\n`);
  };

  subscriber.on("message", onMessage);

  request.raw.on("close", async () => {
    subscriber.off("message", onMessage);
    await subscriber.quit();
  });
});

app.get("/search/suggest", async (request) => {
  const query = z.object({ q: z.string().min(1) }).parse(request.query);
  const result = await db
    .select({
      title: articles.title
    })
    .from(articles)
    .where(ilike(articles.title, `${query.q}%`))
    .limit(10);

  return { items: result };
});

app.setErrorHandler(async (error, _request, reply) => {
  logger.error({ error }, "Gateway request failed");

  if (reply.request.url.startsWith("/trending")) {
    const fallback = await redis.get("trending:news");
    if (fallback) {
      return reply.send(JSON.parse(fallback));
    }
  }

  return reply.code(500).send({
    message: "Request failed",
    fallback: "cached-data-when-available"
  });
});

await app.listen({
  host: "0.0.0.0",
  port
});
