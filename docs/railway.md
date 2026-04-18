# Railway Deployment Guide

This repository is a shared JavaScript monorepo. Railway's docs say JavaScript monorepos can be imported as multiple staged services automatically, and each deployable package can carry its own `railway.json` config file. Railway also injects a `PORT` variable for services and supports private internal DNS with `SERVICE_NAME.railway.internal`.

## Recommended Railway Layout

Create one Railway project with these services:

- `web` from `/apps/web`
- `api-gateway` from `/services/api-gateway`
- `ingestion-service` from `/services/ingestion-service`
- `processing-service` from `/services/processing-service`
- `deduplication-service` from `/services/deduplication-service`
- `enrichment-service` from `/services/enrichment-service`
- `ranking-service` from `/services/ranking-service`
- `user-service` from `/services/user-service`
- `notification-service` from `/services/notification-service`
- PostgreSQL
- Redis

Kafka and Elasticsearch are also required by the current architecture. Add them as separate services if you have container images available, or connect managed external providers and set the environment variables accordingly.

## Variables

Shared variables:

```env
NODE_ENV=production
LOG_LEVEL=info
JWT_SECRET=replace-with-a-long-secret
KAFKA_BROKERS=<your-kafka-brokers>
KAFKA_CLIENT_ID=news-platform
ELASTICSEARCH_NODE=<your-elasticsearch-url>
S3_ENDPOINT=<your-s3-endpoint>
S3_REGION=us-east-1
S3_ACCESS_KEY=<your-s3-access-key>
S3_SECRET_KEY=<your-s3-secret-key>
S3_BUCKET=news-images
```

Service-specific variables:

```env
# web
NEXT_PUBLIC_API_BASE_URL=https://${{api-gateway.RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_SSE_URL=https://${{api-gateway.RAILWAY_PUBLIC_DOMAIN}}/news/stream

# api-gateway
POSTGRES_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
USER_SERVICE_URL=http://${{user-service.RAILWAY_PRIVATE_DOMAIN}}:${{user-service.PORT}}

# ranking-service
POSTGRES_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# user-service
POSTGRES_URL=${{Postgres.DATABASE_URL}}

# ingestion-service / processing-service / deduplication-service / enrichment-service / notification-service
REDIS_URL=${{Redis.REDIS_URL}}
```

Set `user-service.PORT=3000` as a service variable if you want to reference it with Railway variable interpolation.

## Import Flow

1. Push this repository to GitHub.
2. In Railway, create a new project and import the GitHub repo.
3. Let Railway stage the JavaScript monorepo services, or create empty services manually and connect the same repo.
4. For each service, confirm the root directory matches its package path and that the package-local `railway.json` file is being used.
5. Generate a public domain for `web` and `api-gateway`.
6. Add the shared and service-specific variables above.
7. Deploy PostgreSQL and Redis.
8. Attach Kafka and Elasticsearch providers.

## Notes

- The platform already listens on Railway's injected `PORT` variable.
- Health checks are defined in the per-service `railway.json` files.
- Internal service calls should use Railway private networking, not public domains.
