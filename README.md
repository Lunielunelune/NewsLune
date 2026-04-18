# Global News Aggregation Platform

Production-oriented distributed news platform built as a TypeScript monorepo with stateless microservices, Kafka-driven ingestion, PostgreSQL persistence, Elasticsearch search, Redis caching, S3-compatible media storage, and a Next.js frontend.

## Architecture

- `services/api-gateway`: public read/write gateway, SSE endpoint, cache-aware fallbacks
- `services/ingestion-service`: polls RSS feeds every 5 minutes and emits `raw_news`
- `services/processing-service`: normalizes and cleans documents into `processed_news`
- `services/deduplication-service`: URL hash + similarity matching into `deduped_news`
- `services/enrichment-service`: categorization, entities, keyword extraction, summarization
- `services/ranking-service`: computes ranking signals, persists to PostgreSQL, indexes Elasticsearch, emits notifications
- `services/user-service`: user and bookmark APIs
- `services/notification-service`: fans Kafka notifications into Redis pub/sub for SSE delivery
- `apps/web`: SSR-first Next.js application with search, infinite scroll, bookmarking, dark mode, and real-time update indicator

## Shared Packages

- `packages/config`: environment validation
- `packages/contracts`: topic names and event contracts
- `packages/database`: Drizzle schema + migrations
- `packages/observability`: logger setup
- `packages/platform`: Kafka, Redis, Elasticsearch, retry, and circuit-breaker helpers
- `packages/ui`: reusable UI primitives

## Local Setup

1. Install Node.js 22+, Corepack, and pnpm.
2. Copy `.env.example` to `.env` and adjust credentials if needed.
3. Start dependencies with `docker compose -f infra/docker/docker-compose.yml up -d`.
4. Install packages with `pnpm install`.
5. Run migrations with `pnpm db:migrate`.
6. Start the platform with `pnpm dev`.

## Deployment

- Build containers from the service and app Dockerfiles.
- Push images to your registry and update image references under `infra/k8s/base/apps`.
- Apply manifests with `kubectl apply -k infra/k8s/overlays/local`.
- Configure managed PostgreSQL, Redis, Kafka, Elasticsearch, object storage, TLS, and CDN in production.
- For Railway, use the per-service `railway.json` files and the setup guide in `docs/railway.md`.

## Operational Notes

- Scale stateless services with Kubernetes HPA.
- Point CDN origin to object storage or image proxy for article media.
- Use managed Kafka, PostgreSQL read replicas, and Elasticsearch multi-node clusters for production workloads.
- Route DLQ topics to an operator workflow for replay and inspection.
- Extend enrichment with a dedicated model-serving tier for higher-quality summaries and entity resolution.
