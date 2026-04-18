FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY services/ingestion-service ./services/ingestion-service
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @news/ingestion-service build
CMD ["pnpm", "--filter", "@news/ingestion-service", "start"]
