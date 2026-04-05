# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY services/mock-einvoice/ ./services/mock-einvoice/

RUN npm ci --workspace=services/mock-einvoice

RUN npm run build --workspace=services/mock-einvoice

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/services/mock-einvoice/dist ./dist
COPY --from=builder /app/services/mock-einvoice/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3011

CMD ["node", "dist/index.js"]
