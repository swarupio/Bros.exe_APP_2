FROM node:24-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY packages/shared/package.json packages/shared/package.json
COPY packages/knowledge/package.json packages/knowledge/package.json
RUN pnpm install --frozen-lockfile --filter @kayda-sathi/api...

COPY apps/api apps/api
COPY packages/shared packages/shared
COPY packages/knowledge packages/knowledge
RUN pnpm --filter @kayda-sathi/api build

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 8080
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
