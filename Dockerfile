# Build stage
FROM node:20-alpine AS builder

# Prisma + TLS to cloud DBs (e.g. Supabase) need OpenSSL on Alpine
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npm run build
RUN npx prisma generate

# Production stage
FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

# First-time deployments: sync schema + seed, then start.
# If you later generate Prisma migrations, you can switch to `prisma migrate deploy`.
CMD ["sh", "-c", "if [ \"$PRISMA_SYNC_MODE\" = \"migrate\" ]; then npx prisma migrate deploy; else npx prisma db push; fi && if [ \"$PRISMA_SEED\" = \"true\" ]; then npx prisma db seed; fi && node dist/index.js"]
