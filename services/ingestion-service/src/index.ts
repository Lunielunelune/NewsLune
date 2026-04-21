import helmet from "@fastify/helmet";
import { RawNewsEvent, rawNewsEventSchema, topics } from "@news/contracts";
import { createDb, ensureCoreSchema, articles } from "@news/database";
import { CircuitBreaker, createOptionalProducer, createRedisClient, createServiceContext, withRetries } from "@news/platform";
import { desc, eq } from "drizzle-orm";
import Fastify from "fastify";
import Parser from "rss-parser";
import { randomUUID, createHash } from "node:crypto";

const parser = new Parser();
const { logger, config } = createServiceContext("ingestion-service");
const app = Fastify({ loggerInstance: logger });
const producer = await createOptionalProducer("ingestion-service");
await ensureCoreSchema(config.POSTGRES_URL);
const db = createDb(config.POSTGRES_URL);
const redis = createRedisClient();
const feedBreaker = new CircuitBreaker(3, 60_000);
const port = Number(process.env.PORT ?? "3000");

const feeds = [
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "https://www.aljazeera.com/xml/rss/all.xml"
];

await app.register(helmet);

app.get("/health", async () => ({
  status: "ok",
  service: "ingestion-service",
  degraded: {
    messaging: producer === null,
    directIngestion: producer === null
  }
}));

function normalizeText(text?: string) {
  return (text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string) {
  const first = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const second = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...first].filter((token) => second.has(token)).length;
  const union = new Set([...first, ...second]).size;
  return union === 0 ? 0 : intersection / union;
}

function categorize(text: string) {
  const rules: Record<string, RegExp> = {
    World: /\bwar|diplomacy|country|summit|global|foreign\b/i,
    Politics: /\bsenate|president|minister|policy|campaign|election\b/i,
    Business: /\bmarket|stocks|economy|finance|trade|bank\b/i,
    Technology: /\bai|software|chip|startup|technology|data center\b/i,
    Science: /\bspace|research|scientist|climate|study\b/i,
    Health: /\bhealth|disease|hospital|medicine|vaccine\b/i,
    Sports: /\bmatch|league|goal|tournament|nba|fifa\b/i,
    Entertainment: /\bfilm|music|series|celebrity|festival|streaming\b/i
  };

  const match = Object.entries(rules).find(([, pattern]) => pattern.test(text));
  return match?.[0] ?? "World";
}

function summarize(text: string) {
  return text
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(". ");
}

function extractKeywords(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/\W+/)
        .filter((token) => token.length > 4)
    )
  ).slice(0, 10);
}

function extractEntities(title: string) {
  return title
    .split(/\s+/)
    .filter((word) => /^[A-Z][a-zA-Z]+/.test(word))
    .slice(0, 5)
    .map((word) => ({
      text: word,
      type: "Topic"
    }));
}

function calculateRankingScore(publishedAt: string, source: string) {
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  const recencyScore = Math.max(0, 1 - ageHours / 24);
  const sourceQualityScore = ["BBC News", "The New York Times", "Al Jazeera English"].includes(source) ? 1 : 0.6;
  return Math.round((recencyScore * 0.7 + sourceQualityScore * 0.3) * 1000);
}

async function ingestDirectly(item: RawNewsEvent) {
  const existing = await db.select({ id: articles.id }).from(articles).where(eq(articles.url, item.url)).limit(1);
  if (existing.length > 0) {
    return;
  }

  const normalizedTitle = normalizeText(item.title);
  const normalizedContent = normalizeText(item.content || item.description);
  const recent = await db
    .select({
      id: articles.id,
      title: articles.title
    })
    .from(articles)
    .orderBy(desc(articles.publishedAt))
    .limit(100);

  const nearDuplicate = recent.find((candidate) => similarity(normalizedTitle, candidate.title) > 0.9);
  if (nearDuplicate) {
    return;
  }

  const articleText = `${normalizedTitle}. ${normalizedContent}`;
  const category = categorize(articleText);
  const summary = summarize(normalizedContent || normalizedTitle);
  const rankingScore = calculateRankingScore(item.publishedAt, item.source);

  const [created] = await db
    .insert(articles)
    .values({
      title: item.title,
      description: item.description,
      content: normalizedContent,
      summary,
      source: item.source,
      url: item.url,
      imageUrl: item.imageUrl,
      category,
      entities: extractEntities(item.title),
      keywords: extractKeywords(articleText),
      rankingScore,
      publishedAt: new Date(item.publishedAt)
    })
    .returning({ id: articles.id });

  await redis.del("trending:news");
  await redis.publish(
    "news-updates",
    JSON.stringify({
      id: created.id,
      title: item.title,
      category,
      publishedAt: item.publishedAt
    })
  );
}

async function publishNewsItem(item: RawNewsEvent) {
  if (!producer) {
    await ingestDirectly(item);
    return;
  }
  rawNewsEventSchema.parse(item);
  await producer.send({
    topic: topics.rawNews,
    messages: [
      {
        key: createHash("sha256").update(item.url).digest("hex"),
        value: JSON.stringify(item)
      }
    ]
  });
}

async function pollFeeds() {
  await Promise.all(
    feeds.map(async (feedUrl) =>
      withRetries(async () => {
        const feed = await parser.parseURL(feedUrl);

        await Promise.all(
          (feed.items ?? []).slice(0, 25).map(async (item) => {
            if (!item.link || !item.title || !item.pubDate) {
              return;
            }

            await publishNewsItem({
              id: randomUUID(),
              source: feed.title ?? new URL(feedUrl).hostname,
              title: item.title,
              description: item.contentSnippet,
              content: item.content,
              url: item.link,
              imageUrl: item.enclosure?.url,
              publishedAt: new Date(item.pubDate).toISOString(),
              ingestedAt: new Date().toISOString(),
              metadata: {
                author: item.creator
              }
            });
          })
        );
      }, 3, 1_000)
    )
  );
}

if (producer) {
  setInterval(() => {
    feedBreaker.run(() => pollFeeds()).catch((error) => logger.error({ error }, "Failed to poll feeds"));
  }, 5 * 60 * 1000);

  await feedBreaker.run(() => pollFeeds());
} else {
  logger.warn("Kafka is not configured; direct ingestion mode is enabled");
  setInterval(() => {
    feedBreaker.run(() => pollFeeds()).catch((error) => logger.error({ error }, "Failed to ingest feeds directly"));
  }, 5 * 60 * 1000);

  await feedBreaker.run(() => pollFeeds());
}

await app.listen({
  host: "0.0.0.0",
  port
});
