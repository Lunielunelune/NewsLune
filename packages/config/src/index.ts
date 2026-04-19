import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().default("news-platform"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  POSTGRES_URL: z.string().min(1),
  ELASTICSEARCH_NODE: z.string().url().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default("news-images"),
  JWT_SECRET: z.string().min(16),
  USER_SERVICE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SSE_URL: z.string().url().optional()
});

export type AppConfig = z.infer<typeof envSchema>;

export function getConfig(overrides: Partial<NodeJS.ProcessEnv> = {}): AppConfig {
  return envSchema.parse({
    ...process.env,
    ...overrides
  });
}

export function parseKafkaBrokers(config: AppConfig): string[] {
  return (config.KAFKA_BROKERS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}
