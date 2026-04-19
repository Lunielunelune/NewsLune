import helmet from "@fastify/helmet";
import { topics } from "@news/contracts";
import { createOptionalConsumer, createRedisClient, createServiceContext } from "@news/platform";
import Fastify from "fastify";

const { logger } = createServiceContext("notification-service");
const app = Fastify({ logger });
const consumer = await createOptionalConsumer("notification-service", "notification-service");
const redis = createRedisClient();
const port = Number(process.env.PORT ?? "3000");

await app.register(helmet);

app.get("/health", async () => ({
  status: "ok",
  service: "notification-service",
  degraded: {
    messaging: consumer === null
  }
}));

if (consumer) {
  await consumer.subscribe({
    topic: topics.notifications,
    fromBeginning: false
  });

  consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      await redis.publish("news-updates", message.value.toString());
    }
  });
} else {
  logger.warn("Kafka is not configured; notification fanout is disabled");
}

await app.listen({
  host: "0.0.0.0",
  port
});
