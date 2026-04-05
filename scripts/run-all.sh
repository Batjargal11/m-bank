#!/bin/bash
set -e

BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_USER=$(whoami)

export NODE_ENV=development
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=dev-jwt-secret-change-in-production
export JWT_EXPIRY=15m
export REFRESH_TOKEN_EXPIRY=7d
export SMTP_HOST=localhost
export SMTP_PORT=1025

# Using 4000-series ports to avoid conflicts
export AUTH_SERVICE_URL=http://localhost:4001
export INVOICE_SERVICE_URL=http://localhost:4002
export PAYMENT_SERVICE_URL=http://localhost:4003
export NOTIFICATION_SERVICE_URL=http://localhost:4004
export AUDIT_SERVICE_URL=http://localhost:4005
export INTEGRATION_SERVICE_URL=http://localhost:4006
export FINACLE_BASE_URL=http://localhost:4010
export EINVOICE_BASE_URL=http://localhost:4011

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

cd "$BASEDIR"

echo "=== Starting Mock Services ==="
PORT=4010 npx ts-node services/mock-finacle/src/index.ts &
PIDS+=($!)
PORT=4011 npx ts-node services/mock-einvoice/src/index.ts &
PIDS+=($!)
sleep 3

echo "=== Starting Core Services ==="
PORT=4001 DATABASE_URL="postgresql://${LOCAL_USER}@localhost:5432/auth_db" npx ts-node services/auth-service/src/index.ts &
PIDS+=($!)
sleep 3

PORT=4002 DATABASE_URL="postgresql://${LOCAL_USER}@localhost:5432/invoice_db" npx ts-node services/invoice-service/src/index.ts &
PIDS+=($!)
PORT=4003 DATABASE_URL="postgresql://${LOCAL_USER}@localhost:5432/payment_db" npx ts-node services/payment-service/src/index.ts &
PIDS+=($!)
PORT=4004 DATABASE_URL="postgresql://${LOCAL_USER}@localhost:5432/notification_db" npx ts-node services/notification-service/src/index.ts &
PIDS+=($!)
PORT=4005 DATABASE_URL="postgresql://${LOCAL_USER}@localhost:5432/audit_db" npx ts-node services/audit-service/src/index.ts &
PIDS+=($!)
PORT=4006 DATABASE_URL="postgresql://${LOCAL_USER}@localhost:5432/integration_db" npx ts-node services/integration-service/src/index.ts &
PIDS+=($!)
sleep 4

echo "=== Starting API Gateway ==="
PORT=4000 npx ts-node services/api-gateway/src/index.ts &
PIDS+=($!)
sleep 2

echo ""
echo "========================================="
echo "  M-Bank - All Services Running"
echo "========================================="
echo "  API Gateway:    http://localhost:4000"
echo "  Auth Service:   http://localhost:4001"
echo "  Invoice:        http://localhost:4002"
echo "  Payment:        http://localhost:4003"
echo "  Notification:   http://localhost:4004"
echo "  Audit:          http://localhost:4005"
echo "  Integration:    http://localhost:4006"
echo "  Mock Finacle:   http://localhost:4010"
echo "  Mock e-Invoice: http://localhost:4011"
echo "========================================="
echo "  Press Ctrl+C to stop all"
echo ""

wait
