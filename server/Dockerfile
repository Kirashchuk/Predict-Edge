# Hono-on-Bun backend.
FROM oven/bun:1.3.5-alpine AS base
WORKDIR /app

# Install dependencies (cached layer)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# App source
COPY . .

ENV NODE_ENV=production
EXPOSE 8787

CMD ["bun", "run", "src/index.ts"]
