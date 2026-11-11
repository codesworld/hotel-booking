# ---- build stage: install everything and compile TypeScript ----
FROM node:20-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime stage: only what is needed to run ----
FROM node:20-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY openapi.yaml package.json ./
USER node

# Build DATABASE_URL from the POSTGRES_* / DB_* variables (unless given directly),
# apply database migrations, then start the API.
CMD ["sh", "-c", "export DATABASE_URL=\"${DATABASE_URL:-postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$DB_HOST:$DB_PORT/$POSTGRES_DB}\" && npx prisma migrate deploy && node dist/index.js"]
