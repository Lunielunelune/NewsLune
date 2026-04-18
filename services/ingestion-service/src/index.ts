import helmet from "@fastify/helmet";
import { RawNewsEvent, rawNewsEventSchema, topics } from "@news/contracts";
import { CircuitBreaker, createProducer, createServiceContext, withRetries } from "@news/platform";
import Fastify from "fastify";
import Parser from "rss-parser";
import { randomUUID, createHash } from "node:crypto";

const parser = new Parser();
const { logger } = createServiceContext("ingestion-service");
const app = Fastify({ logger });
const producer = await createProducer("ingestion-service");
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
  service: "ingestion-service"
}));

async function publishNewsItem(item: RawNewsEvent) {
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

setInterval(() => {
  feedBreaker.run(() => pollFeeds()).catch((error) => logger.error({ error }, "Failed to poll feeds"));
}, 5 * 60 * 1000);

await feedBreaker.run(() => pollFeeds());

await app.listen({
  host: "0.0.0.0",
  port
});
