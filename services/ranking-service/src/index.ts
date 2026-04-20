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

const demoArticles = [
  {
    title: "Global chipmakers accelerate investment in new AI data center capacity",
    description: "Major semiconductor manufacturers are expanding production and packaging capacity to meet sustained AI infrastructure demand.",
    content:
      "Chipmakers across Asia, Europe, and the United States are expanding advanced packaging, foundry capacity, and power-efficient server component lines as AI spending remains elevated. Analysts say the next wave of growth will center on data center efficiency rather than raw model size alone.",
    summary:
      "Semiconductor companies are investing heavily in new AI infrastructure capacity. The industry focus is shifting toward efficient, scalable data center growth.",
    source: "Aperture Markets Desk",
    url: "https://aperture-news.example.com/demo/ai-chipmakers-expand-capacity",
    category: "Technology",
    entities: [{ text: "AI", type: "Technology" }, { text: "chipmakers", type: "Organization" }],
    keywords: ["AI", "chips", "data center", "semiconductors"],
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    title: "Coastal cities test heat resilience plans ahead of record summer forecasts",
    description: "Urban planners are rolling out cooling centers, transit adjustments, and emergency health alerts as heat risk climbs.",
    content:
      "Public agencies in multiple coastal cities are preparing for a difficult summer with expanded cooling infrastructure, updated emergency notification rules, and new public health coordination plans. Climate researchers say prolonged nighttime heat remains a growing concern.",
    summary:
      "Cities are launching new heat resilience measures before an expected severe summer. Officials are focusing on public health alerts and cooling access.",
    source: "Aperture Climate Desk",
    url: "https://aperture-news.example.com/demo/coastal-cities-heat-resilience",
    category: "Science",
    entities: [{ text: "coastal cities", type: "Location" }, { text: "heat resilience", type: "Topic" }],
    keywords: ["climate", "heat", "cities", "public health"],
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    title: "Global markets steady as central banks signal a slower path to cuts",
    description: "Equities were mixed while bond traders recalibrated after policymakers emphasized patience on inflation.",
    content:
      "Investors digested a fresh round of central bank commentary pointing to slower-than-expected rate cuts. Equity indexes traded in a narrow range as bond yields adjusted modestly higher, with strategists warning that volatility could return if inflation data surprises again.",
    summary:
      "Markets stabilized after central banks signaled a slower pace for rate cuts. Investors remain cautious about future inflation data.",
    source: "Aperture Finance",
    url: "https://aperture-news.example.com/demo/markets-central-banks-slower-cuts",
    category: "Business",
    entities: [{ text: "central banks", type: "Organization" }, { text: "markets", type: "Topic" }],
    keywords: ["markets", "rates", "inflation", "equities"],
    publishedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
  },
  {
    title: "Regional health systems expand virtual triage to ease emergency room strain",
    description: "Hospitals are directing more low-acuity patients into telehealth workflows before in-person treatment.",
    content:
      "Health systems are scaling virtual triage programs to reduce emergency room congestion and shorten wait times. Clinicians say remote intake helps direct patients more efficiently while preserving capacity for more urgent cases.",
    summary:
      "Hospitals are using virtual triage to reduce emergency room crowding. The approach aims to route non-urgent cases more efficiently.",
    source: "Aperture Health",
    url: "https://aperture-news.example.com/demo/virtual-triage-health-systems",
    category: "Health",
    entities: [{ text: "health systems", type: "Organization" }, { text: "telehealth", type: "Technology" }],
    keywords: ["health", "telehealth", "hospital", "triage"],
    publishedAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString()
  },
  {
    title: "Diplomats reopen trade talks after supply corridor disruptions",
    description: "Officials from multiple regions resumed negotiations focused on shipping resilience and tariff coordination.",
    content:
      "Trade officials returned to the negotiating table after several weeks of supply corridor instability. The talks are focused on logistics resilience, customs simplification, and targeted tariff relief for critical goods.",
    summary:
      "Diplomats have reopened trade talks following supply disruptions. The agenda centers on shipping resilience and tariff coordination.",
    source: "Aperture World",
    url: "https://aperture-news.example.com/demo/trade-talks-supply-corridor",
    category: "World",
    entities: [{ text: "diplomats", type: "Person" }, { text: "trade talks", type: "Topic" }],
    keywords: ["trade", "shipping", "tariffs", "diplomacy"],
    publishedAt: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString()
  },
  {
    title: "Streaming platforms shift release calendars toward fewer but larger tentpoles",
    description: "Studios are consolidating budgets around flagship titles as subscriber growth becomes harder to win cheaply.",
    content:
      "Media companies are concentrating more of their annual budgets on fewer premium shows and films. Executives say the move reflects a tougher subscriber environment and a renewed focus on event-style releases.",
    summary:
      "Streaming platforms are betting on fewer, larger flagship releases. Studios are prioritizing high-impact titles over volume.",
    source: "Aperture Culture",
    url: "https://aperture-news.example.com/demo/streaming-platforms-tentpole-releases",
    category: "Entertainment",
    entities: [{ text: "streaming platforms", type: "Organization" }, { text: "studios", type: "Organization" }],
    keywords: ["streaming", "film", "series", "media"],
    publishedAt: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString()
  }
] as const;

async function seedDemoArticlesIfNeeded() {
  const existing = await db.select({ id: articles.id }).from(articles).limit(1);
  if (existing.length > 0) {
    return;
  }

  logger.warn("No ranked articles found; seeding demo articles for reduced mode");

  for (const article of demoArticles) {
    const { rankingScore } = calculateRankingScore(article.publishedAt, article.source);
    await db.insert(articles).values({
      title: article.title,
      description: article.description,
      content: article.content,
      summary: article.summary,
      source: article.source,
      url: article.url,
      category: article.category,
      entities: [...article.entities],
      keywords: [...article.keywords],
      rankingScore,
      publishedAt: new Date(article.publishedAt)
    });
  }

  await redis.del("trending:news");
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
  await seedDemoArticlesIfNeeded();
}

await app.listen({
  host: "0.0.0.0",
  port
});
