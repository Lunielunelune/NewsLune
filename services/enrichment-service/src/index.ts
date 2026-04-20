import helmet from "@fastify/helmet";
import {
  articleCategories,
  dedupedNewsEventSchema,
  enrichedNewsEventSchema,
  topics
} from "@news/contracts";
import { createOptionalConsumer, createOptionalProducer, createServiceContext } from "@news/platform";
import Fastify from "fastify";
import nlp from "compromise";

const { logger } = createServiceContext("enrichment-service");
const app = Fastify({ loggerInstance: logger });
const consumer = await createOptionalConsumer("enrichment-service", "enrichment-service");
const producer = await createOptionalProducer("enrichment-service");
const port = Number(process.env.PORT ?? "3000");

await app.register(helmet);

app.get("/health", async () => ({
  status: "ok",
  service: "enrichment-service",
  degraded: {
    messaging: consumer === null || producer === null
  }
}));

function categorize(text: string): (typeof articleCategories)[number] {
  const rules: Record<(typeof articleCategories)[number], RegExp> = {
    World: /\bwar|diplomacy|country|election abroad|summit\b/i,
    Politics: /\bsenate|president|minister|policy|campaign\b/i,
    Business: /\bmarket|stocks|economy|finance|trade\b/i,
    Technology: /\bai|software|chip|startup|technology\b/i,
    Science: /\bspace|research|scientist|climate|study\b/i,
    Health: /\bhealth|disease|hospital|medicine|vaccine\b/i,
    Sports: /\bmatch|league|goal|tournament|nba|fifa\b/i,
    Entertainment: /\bfilm|music|series|celebrity|festival\b/i
  };

  const match = Object.entries(rules).find(([, pattern]) => pattern.test(text));
  return (match?.[0] as (typeof articleCategories)[number]) ?? "World";
}

function summarize(text: string) {
  return text
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(". ");
}

if (consumer && producer) {
  await consumer.subscribe({
    topic: topics.dedupedNews,
    fromBeginning: false
  });

  consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.value) {
      return;
    }

    try {
      const event = dedupedNewsEventSchema.parse(JSON.parse(message.value.toString()));
      if (event.duplicate) {
        return;
      }

      const doc = nlp(`${event.normalizedTitle}. ${event.normalizedContent}`);
      const entities = doc.topics().json().map((entry) => ({
        text: entry.text,
        type: entry.topics?.[0] ?? "Topic"
      }));
      const keywords = doc.nouns().out("array").slice(0, 10);
      const summary = summarize(event.normalizedContent || event.description || event.title);
      const category = categorize(`${event.normalizedTitle} ${event.normalizedContent}`);

      const enriched = enrichedNewsEventSchema.parse({
        ...event,
        category,
        entities,
        summary,
        sentiment: 0,
        keywords
      });

      await producer.send({
        topic: topics.enrichedNews,
        messages: [
          {
            key: enriched.canonicalId,
            value: JSON.stringify(enriched)
          }
        ]
      });
    } catch (error) {
      logger.error({ error }, "Failed to enrich article");
      await producer.send({
        topic: topics.enrichmentDlq,
        messages: [
          {
            key: message.key?.toString(),
            value: message.value.toString()
          }
        ]
      });
    }
    }
  });
} else {
  logger.warn("Kafka is not configured; enrichment pipeline is disabled");
}

await app.listen({
  host: "0.0.0.0",
  port
});
