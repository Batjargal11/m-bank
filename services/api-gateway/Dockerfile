# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/ ./packages/
COPY services/api-gateway/ ./services/api-gateway/

RUN npm ci --workspace=packages/shared-types \
    --workspace=packages/shared-utils \
    --workspace=services/api-gateway

RUN npm run build --workspace=packages/shared-types \
    && npm run build --workspace=packages/shared-utils \
    && npm run build --workspace=services/api-gateway

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/services/api-gateway/dist ./dist
COPY --from=builder /app/services/api-gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3000

CMD ["node", "dist/index.js"]
