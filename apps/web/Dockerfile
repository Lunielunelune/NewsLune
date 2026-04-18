FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @news/web build
WORKDIR /app/apps/web
CMD ["pnpm", "start"]
