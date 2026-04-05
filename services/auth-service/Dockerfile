# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/ ./packages/
COPY services/auth-service/ ./services/auth-service/

RUN npm ci --workspace=packages/shared-types \
    --workspace=packages/shared-utils \
    --workspace=packages/shared-middleware \
    --workspace=services/auth-service

RUN npm run build --workspace=packages/shared-types \
    && npm run build --workspace=packages/shared-utils \
    && npm run build --workspace=packages/shared-middleware \
    && npm run build --workspace=services/auth-service

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/services/auth-service/dist ./dist
COPY --from=builder /app/services/auth-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3001

CMD ["node", "dist/index.js"]
