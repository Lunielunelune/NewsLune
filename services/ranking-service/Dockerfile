FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY services/ranking-service ./services/ranking-service
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @news/ranking-service build
CMD ["pnpm", "--filter", "@news/ranking-service", "start"]
