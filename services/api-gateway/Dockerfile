FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY services/api-gateway ./services/api-gateway
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @news/api-gateway build
CMD ["pnpm", "--filter", "@news/api-gateway", "start"]

