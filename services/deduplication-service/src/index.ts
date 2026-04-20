import helmet from "@fastify/helmet";
import {
  dedupedNewsEventSchema,
  processedNewsEventSchema,
  topics
} from "@news/contracts";
import { createOptionalConsumer, createOptionalProducer, createRedisClient, createServiceContext } from "@news/platform";
import Fastify from "fastify";

const { logger } = createServiceContext("deduplication-service");
const app = Fastify({ loggerInstance: logger });
const consumer = await createOptionalConsumer("deduplication-service", "deduplication-service");
const producer = await createOptionalProducer("deduplication-service");
const redis = createRedisClient();
const port = Number(process.env.PORT ?? "3000");

await app.register(helmet);

app.get("/health", async () => ({
  status: "ok",
  service: "deduplication-service",
  degraded: {
    messaging: consumer === null || producer === null
  }
}));

function similarity(a: string, b: string) {
  const first = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const second = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...first].filter((token) => second.has(token)).length;
  const union = new Set([...first, ...second]).size;
  return union === 0 ? 0 : intersection / union;
}

if (consumer && producer) {
  await consumer.subscribe({
    topic: topics.processedNews,
    fromBeginning: false
  });

  consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.value) {
      return;
    }

    try {
      const event = processedNewsEventSchema.parse(JSON.parse(message.value.toString()));
      const existing = await redis.hgetall("dedupe:index");
      let duplicate = false;
      let similarityScore = 0;
      let canonicalId = event.id;

      for (const [candidateId, candidateTitle] of Object.entries(existing)) {
        const score = similarity(event.normalizedTitle, candidateTitle);
        if (score > 0.86) {
          duplicate = true;
          similarityScore = score;
          canonicalId = candidateId;
          break;
        }
      }

      if (!duplicate) {
        await redis.hset("dedupe:index", event.id, event.normalizedTitle);
        similarityScore = 1;
      }

      const payload = dedupedNewsEventSchema.parse({
        ...event,
        duplicate,
        similarityScore,
        canonicalId
      });

      await producer.send({
        topic: topics.dedupedNews,
        messages: [
          {
            key: payload.canonicalId,
            value: JSON.stringify(payload)
          }
        ]
      });
    } catch (error) {
      logger.error({ error }, "Failed to deduplicate article");
      await producer.send({
        topic: topics.dedupeDlq,
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
  logger.warn("Kafka is not configured; deduplication pipeline is disabled");
}

await app.listen({
  host: "0.0.0.0",
  port
});
