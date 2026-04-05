#!/bin/bash
# Start all services locally
# Usage: ./scripts/start-local.sh

set -e

BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_USER=$(whoami)

# Common env
export NODE_ENV=development
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=dev-jwt-secret-change-in-production
export JWT_EXPIRY=15m
export REFRESH_TOKEN_EXPIRY=7d

# Service URLs
export AUTH_SERVICE_URL=http://localhost:3001
export INVOICE_SERVICE_URL=http://localhost:3002
export PAYMENT_SERVICE_URL=http://localhost:3003
export NOTIFICATION_SERVICE_URL=http://localhost:3004
export AUDIT_SERVICE_URL=http://localhost:3005
export INTEGRATION_SERVICE_URL=http://localhost:3006
export FINACLE_BASE_URL=http://localhost:3010
export EINVOICE_BASE_URL=http://localhost:3011
export SMTP_HOST=localhost
export SMTP_PORT=1025

PIDS=()

cleanup() {
  echo ""
  echo "Stopping all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo "All services stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

start_service() {
  local name=$1
  local port=$2
  local dir=$3
  local db=$4

  if [ -n "$db" ]; then
    export DATABASE_URL="postgresql://${LOCAL_USER}@localhost:5432/${db}"
  fi
  export PORT=$port

  echo "Starting $name on port $port..."
  cd "$BASEDIR/$dir"
  npx ts-node src/index.ts &
  PIDS+=($!)
  cd "$BASEDIR"
}

echo "=== M-Bank Local Development ==="
echo ""

# Start mock services first (no DB needed)
start_service "mock-finacle" 3010 "services/mock-finacle" ""
start_service "mock-einvoice" 3011 "services/mock-einvoice" ""

sleep 2

# Start core services
start_service "auth-service" 3001 "services/auth-service" "auth_db"
start_service "invoice-service" 3002 "services/invoice-service" "invoice_db"
start_service "payment-service" 3003 "services/payment-service" "payment_db"
start_service "notification-service" 3004 "services/notification-service" "notification_db"
start_service "audit-service" 3005 "services/audit-service" "audit_db"
start_service "integration-service" 3006 "services/integration-service" "integration_db"

sleep 2

# Start API gateway last
start_service "api-gateway" 3000 "services/api-gateway" ""

echo ""
echo "=== All services starting ==="
echo "API Gateway:    http://localhost:3000"
echo "Auth Service:   http://localhost:3001"
echo "Invoice:        http://localhost:3002"
echo "Payment:        http://localhost:3003"
echo "Notification:   http://localhost:3004"
echo "Audit:          http://localhost:3005"
echo "Integration:    http://localhost:3006"
echo "Mock Finacle:   http://localhost:3010"
echo "Mock e-Invoice: http://localhost:3011"
echo ""
echo "Press Ctrl+C to stop all services"

wait
