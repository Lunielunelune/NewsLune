import helmet from "@fastify/helmet";
import {
  processedNewsEventSchema,
  rawNewsEventSchema,
  topics
} from "@news/contracts";
import { createOptionalConsumer, createOptionalProducer, createServiceContext } from "@news/platform";
import Fastify from "fastify";
import { createHash } from "node:crypto";

const { logger } = createServiceContext("processing-service");
const app = Fastify({ logger });
const consumer = await createOptionalConsumer("processing-service", "processing-service");
const producer = await createOptionalProducer("processing-service");
const port = Number(process.env.PORT ?? "3000");

await app.register(helmet);

app.get("/health", async () => ({
  status: "ok",
  service: "processing-service",
  degraded: {
    messaging: consumer === null || producer === null
  }
}));

function normalizeText(text?: string) {
  return (text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

if (consumer && producer) {
  await consumer.subscribe({
    topic: topics.rawNews,
    fromBeginning: false
  });

  consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.value) {
      return;
    }

    const event = rawNewsEventSchema.parse(JSON.parse(message.value.toString()));
    try {
      const normalizedTitle = normalizeText(event.title);
      const normalizedContent = normalizeText(event.content || event.description);
      const processed = processedNewsEventSchema.parse({
        ...event,
        normalizedTitle,
        normalizedContent,
        urlHash: createHash("sha256").update(event.url).digest("hex"),
        language: "en"
      });

      await producer.send({
        topic: topics.processedNews,
        messages: [
          {
            key: processed.urlHash,
            value: JSON.stringify(processed)
          }
        ]
      });
    } catch (error) {
      logger.error({ error }, "Failed to process article");
      await producer.send({
        topic: topics.processingDlq,
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
  logger.warn("Kafka is not configured; processing pipeline is disabled");
}

await app.listen({
  host: "0.0.0.0",
  port
});
