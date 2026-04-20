import helmet from "@fastify/helmet";
import { enrichedNewsEventSchema, topics } from "@news/contracts";
import { createDb, articles } from "@news/database";
import {
  createOptionalConsumer,
  createOptionalProducer,
  createOptionalSearchClient,
  createRedisClient,
  createServiceContext
} from "@news/platform";
import { eq } from "drizzle-orm";
import Fastify from "fastify";

const { logger, config } = createServiceContext("ranking-service");
const app = Fastify({ loggerInstance: logger });
const consumer = await createOptionalConsumer("ranking-service", "ranking-service");
const producer = await createOptionalProducer("ranking-service");
const db = createDb(config.POSTGRES_URL);
const redis = createRedisClient();
const search = createOptionalSearchClient();
const port = Number(process.env.PORT ?? "3000");

await app.register(helmet);

app.get("/health", async () => ({
  status: "ok",
  service: "ranking-service",
  degraded: {
    messaging: consumer === null || producer === null,
    search: search === null
  }
}));

function scoreSource(source: string) {
  const trusted = ["BBC News", "The New York Times", "Al Jazeera English"];
  return trusted.includes(source) ? 1 : 0.6;
}

function calculateRankingScore(publishedAt: string, source: string) {
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  const recencyScore = Math.max(0, 1 - ageHours / 24);
  const popularityScore = 0.5;
  const sourceQualityScore = scoreSource(source);
  const rankingScore = Math.round((recencyScore * 0.5 + popularityScore * 0.2 + sourceQualityScore * 0.3) * 1000);

  return {
    rankingScore,
    rankingFactors: {
      recencyScore,
      popularityScore,
      sourceQualityScore
    }
  };
}

if (consumer) {
  await consumer.subscribe({
    topic: topics.enrichedNews,
    fromBeginning: false
  });

  consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.value) {
      return;
    }

    try {
      const event = enrichedNewsEventSchema.parse(JSON.parse(message.value.toString()));
      const { rankingScore, rankingFactors } = calculateRankingScore(event.publishedAt, event.source);

      const existing = await db.select().from(articles).where(eq(articles.url, event.url)).limit(1);
      let articleId = existing[0]?.id;

      if (existing.length === 0) {
        const [created] = await db
          .insert(articles)
          .values({
            title: event.title,
            description: event.description,
            content: event.content,
            summary: event.summary,
            source: event.source,
            url: event.url,
            imageUrl: event.imageUrl,
            category: event.category,
            entities: event.entities,
            keywords: event.keywords,
            rankingScore,
            publishedAt: new Date(event.publishedAt)
          })
          .returning({ id: articles.id });
        articleId = created.id;
      }

      if (search) {
        await search.index({
          index: "articles",
          id: articleId,
          document: {
            ...event,
            id: articleId,
            rankingScore,
            rankingFactors
          }
        });
      }

      await redis.del("trending:news");
      if (producer) {
        await producer.send({
          topic: topics.notifications,
          messages: [
            {
              key: event.canonicalId,
              value: JSON.stringify({
                id: articleId,
                title: event.title,
                category: event.category,
                publishedAt: event.publishedAt
              })
            }
          ]
        });
      }
    } catch (error) {
      logger.error({ error }, "Failed to rank article");
      if (producer) {
        await producer.send({
          topic: topics.rankingDlq,
          messages: [
            {
              key: message.key?.toString(),
              value: message.value.toString()
            }
          ]
        });
      }
    }
  }
  });
} else {
  logger.warn("Kafka is not configured; ranking pipeline is disabled");
}

await app.listen({
  host: "0.0.0.0",
  port
});
