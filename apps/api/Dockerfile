# syntax=docker/dockerfile:1

# ---- build: full deps, Prisma client, compiled app ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate --config prisma7.config.ts && npm run build

# ---- migrate: reuses the build stage (the prisma CLI is a dev dependency) ----
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]

# ---- runtime: production deps + compiled output only ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
