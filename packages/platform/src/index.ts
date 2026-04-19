import { Client as ElasticsearchClient } from "@elastic/elasticsearch";
import { AppConfig, getConfig, parseKafkaBrokers } from "@news/config";
import { AppLogger, createLogger } from "@news/observability";
import Redis from "ioredis";
import { Consumer, Kafka, Producer } from "kafkajs";

export function createKafkaClient(serviceName: string) {
  const config = getConfig();

  return new Kafka({
    clientId: `${config.KAFKA_CLIENT_ID}-${serviceName}`,
    brokers: parseKafkaBrokers(config)
  });
}

export async function createProducer(serviceName: string): Promise<Producer> {
  const producer = createKafkaClient(serviceName).producer({
    allowAutoTopicCreation: false,
    transactionTimeout: 30_000
  });

  await producer.connect();
  return producer;
}

export async function createConsumer(serviceName: string, groupId: string): Promise<Consumer> {
  const consumer = createKafkaClient(serviceName).consumer({
    groupId,
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000
  });

  await consumer.connect();
  return consumer;
}

export function createRedisClient() {
  return new Redis(getConfig().REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true
  });
}

export function createSearchClient() {
  return new ElasticsearchClient({
    node: getConfig().ELASTICSEARCH_NODE
  });
}

export async function withRetries<T>(operation: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}

export interface ServiceContext {
  serviceName: string;
  logger: AppLogger;
  config: AppConfig;
}

export function createServiceContext(serviceName: string): ServiceContext {
  return {
    serviceName,
    logger: createLogger(serviceName),
    config: getConfig()
  };
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly cooldownMs = 30_000
  ) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error("Circuit breaker is open");
    }

    try {
      const result = await operation();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.failureThreshold) {
        this.openedAt = Date.now();
      }
      throw error;
    }
  }

  private isOpen() {
    return this.openedAt > 0 && Date.now() - this.openedAt < this.cooldownMs;
  }
}
