# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY services/mock-finacle/ ./services/mock-finacle/

RUN npm ci --workspace=services/mock-finacle

RUN npm run build --workspace=services/mock-finacle

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/services/mock-finacle/dist ./dist
COPY --from=builder /app/services/mock-finacle/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3010

CMD ["node", "dist/index.js"]
