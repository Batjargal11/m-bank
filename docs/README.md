# M-Bank: Inter-Bank Invoice Exchange System

## Overview

A secure and reliable demo system for organizations to create, send, receive, pay, and cancel invoices between each other through internet banking.

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Express + TypeScript (per microservice) |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Database | PostgreSQL 16 (database-per-service) |
| Message Queue | Redis 7 + BullMQ (async messaging) |
| Infra | Docker Compose / Local dev |

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### Installation

```bash
# 1. Clone + Install
cd m-bank
npm install

# 2. Create databases
for db in auth_db invoice_db payment_db notification_db audit_db integration_db; do
  createdb $db
done

# 3. Build shared packages
npx tsc --project packages/shared-types/tsconfig.json
npx tsc --project packages/shared-utils/tsconfig.json
npx tsc --project packages/shared-middleware/tsconfig.json

# 4. Seed test data
AUTH_DATABASE_URL="postgresql://$(whoami)@localhost:5432/auth_db" npx ts-node scripts/seed-db.ts

# 5. Start all services
bash scripts/run-all.sh

# 6. Start frontend (new terminal)
cd frontend && npx vite --port 5173
```

### Login

Open `http://localhost:5173` in browser.

| Username | Password | Role | Permissions |
|----------|----------|------|------------|
| `maker_a` | password123 | CORPORATE_MAKER | Create, send invoices |
| `maker_b` | password123 | CORPORATE_MAKER | Create, send invoices |
| `user_a` | password123 | CORPORATE_USER | View invoices, make payments |
| `user_b` | password123 | CORPORATE_USER | View invoices, make payments |
| `approver_a` | password123 | CORPORATE_APPROVER | Approve payments, cancel invoices |
| `approver_b` | password123 | CORPORATE_APPROVER | Approve payments, cancel invoices |
| `admin` | password123 | SYSTEM_ADMIN | Full access + Admin panel |
| `operator` | password123 | BANK_OPERATOR | Audit logs, reports |

### Test Organizations

| Organization | Reg. No | MNT Account | USD Account |
|-------------|---------|-------------|-------------|
| Mongol Technology LLC | REG-001 | 1001000001 (50M) | 1001000002 (100K) |
| Ulaanbaatar Trade LLC | REG-002 | 2001000001 (30M) | 2001000002 (50K) |

---

## Architecture

### Services

```
┌──────────┐     ┌─────────────┐     ┌──────────────────────────────────┐
│ Frontend │────▶│ API Gateway │────▶│  Internal Services               │
│ React    │     │ :4000       │     │                                  │
└──────────┘     └─────────────┘     │  Auth Service        :4001      │
                                     │  Invoice Service     :4002      │
                                     │  Payment Service     :4003      │
                                     │  Notification Service :4004     │
                                     │  Audit Service       :4005      │
                                     │  Integration Service :4006      │
                                     └──────────────┬───────────────────┘
                                                    │ BullMQ (Redis)
                                     ┌──────────────┴───────────────────┐
                                     │  Mock Finacle    :4010           │
                                     │  Mock e-Invoice  :4011           │
                                     └──────────────────────────────────┘
```

| Service | Port | Purpose | Database |
|---------|------|---------|----------|
| API Gateway | 4000 | JWT verify, rate limit, proxy routing | — |
| Auth Service | 4001 | Login, RBAC, users, organizations, accounts | auth_db |
| Invoice Service | 4002 | Invoice CRUD, status management | invoice_db |
| Payment Service | 4003 | Payment processing, idempotency, Finacle integration | payment_db |
| Notification Service | 4004 | In-app notifications, email | notification_db |
| Audit Service | 4005 | Audit logs, integration logs | audit_db |
| Integration Service | 4006 | Finacle/e-Invoice adapter, retry queue | integration_db |
| Mock Finacle | 4010 | Core Banking simulator | in-memory |
| Mock e-Invoice | 4011 | Tax system simulator | in-memory |
| Frontend | 5173 | React SPA | — |

### Communication Patterns

**Synchronous (HTTP REST):**
- API Gateway → Auth Service (JWT verification)
- Invoice Service → Auth Service (resolve org name)
- Payment Service → Integration Service (account validation)
- Integration Service → Mock Finacle/e-Invoice (execute transfer)

**Asynchronous (BullMQ Queue):**
- `invoice.status-changed` → Notification, Audit, Integration
- `payment.initiated` → Integration (Finacle transfer)
- `payment.status-changed` → Invoice (paid_amount update), Notification, Audit
- `integration.finacle-result` → Payment (status update)
- `integration.einvoice-result` → Invoice (ref update)

---

## Business Process

### 1. Invoice Send Flow

```
Maker (Org A)                       System                        User (Org B)
     │                                │                                │
     │ 1. Create invoice (DRAFT)      │                                │
     ├───────────────────────────────►│                                │
     │                                │                                │
     │ 2. Send invoice                │                                │
     ├───────────────────────────────►│                                │
     │                                │ DRAFT→VERIFIED→SENT→RECEIVED   │
     │                                │                                │
     │                                │ 3. Invoice appears in received │
     │                                │───────────────────────────────►│
     │                                │                                │
     │                                │ 4. View detail (VIEWED)        │
     │                                │◄───────────────────────────────┤
     │                                │                                │
```

### 2. Payment Flow

```
User (Org B)          Payment Service     Integration       Mock Finacle
     │                      │                  │                  │
     │ 1. Initiate payment  │                  │                  │
     ├─────────────────────►│                  │                  │
     │                      │ 2. Validate acc  │                  │
     │                      ├─────────────────►│                  │
     │                      │                  │ 3. Finacle call  │
     │                      │                  ├─────────────────►│
     │                      │                  │◄── valid ────────┤
     │                      │◄── valid ────────┤                  │
     │                      │                  │                  │
     │◄─ PAYMENT_PENDING ───┤                  │                  │
     │                      │                  │                  │
     │   (BullMQ async)     │                  │                  │
     │                      │ 4. payment.initiated               │
     │                      │─ ─ ─ ─ ─ ─ ─ ─►│                  │
     │                      │                  │ 5. Balance check │
     │                      │                  ├─────────────────►│
     │                      │                  │ 6. Transfer      │
     │                      │                  ├─────────────────►│
     │                      │                  │◄─ txn_ref ───────┤
     │                      │                  │                  │
     │                      │ 7. finacle.result│                  │
     │                      │◄─ ─ ─ ─ ─ ─ ─ ─┤                  │
     │                      │                  │                  │
     │                      │ 8. Update → PAID │                  │
     │                      │    + txn_ref     │                  │
     │                      │                  │                  │
     │ 9. GET payment       │                  │                  │
     ├─────────────────────►│                  │                  │
     │◄─ PAID + txn_ref ────┤                  │                  │
```

### 3. Invoice Status Lifecycle

```
DRAFT → VERIFIED → SENT → RECEIVED → VIEWED → PAYMENT_PENDING → PAYMENT_PROCESSING
                                                                        │
                                                      PARTIALLY_PAID ←──┤──► PAID
                                                                        │
                                                                     FAILED
SENT/RECEIVED/VIEWED → CANCEL_REQUESTED → CANCELLED

                                                     EXPIRED (cron job)
```

| Status | Description |
|--------|-------------|
| DRAFT | Draft — can be edited or deleted |
| VERIFIED | Verified automatically before sending |
| SENT | Sent to receiver organization |
| RECEIVED | Delivered to receiver (auto-transition) |
| VIEWED | Viewed by receiver |
| PAYMENT_PENDING | Payment initiated, awaiting processing |
| PAYMENT_PROCESSING | Being processed via Finacle |
| PARTIALLY_PAID | Partially paid |
| PAID | Fully paid |
| CANCEL_REQUESTED | Cancellation requested |
| CANCELLED | Cancelled |
| FAILED | Payment failed |
| EXPIRED | Expired (past due date) |

---

## API Reference

### Auth Service (`/api/auth/*`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login `{username, password}` → `{tokens, user}` |
| POST | `/api/auth/refresh` | No | Refresh token `{refreshToken}` |
| POST | `/api/auth/logout` | Yes | Logout |

### Organizations (`/api/organizations/*`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/organizations` | Yes | List organizations |
| GET | `/api/organizations/:id` | Yes | Get organization detail |
| GET | `/api/organizations/:id/accounts` | Yes | List accounts |

### Users (`/api/users/*`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Yes | List users (admin sees all) |

### Invoice Service (`/api/invoices/*`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/api/invoices?direction=sent\|received` | Yes | — | List invoices |
| GET | `/api/invoices/stats` | Yes | — | Dashboard statistics |
| POST | `/api/invoices` | Yes | invoice:create | Create invoice |
| GET | `/api/invoices/:id` | Yes | invoice:view | Get detail with items |
| PUT | `/api/invoices/:id` | Yes | invoice:create | Update DRAFT |
| DELETE | `/api/invoices/:id` | Yes | invoice:create | Delete DRAFT |
| POST | `/api/invoices/:id/send` | Yes | invoice:send | Send to receiver |
| POST | `/api/invoices/:id/view` | Yes | invoice:view | Mark as viewed |
| POST | `/api/invoices/:id/cancel` | Yes | — | Request cancellation |
| GET | `/api/invoices/:id/history` | Yes | invoice:view | Status change history |

**Create Invoice Example:**
```json
POST /api/invoices
{
  "invoice_no": "INV-2026-001",
  "receiver_org_id": "b0000000-0000-0000-0000-000000000002",
  "issue_date": "2026-03-31",
  "due_date": "2026-04-30",
  "currency": "MNT",
  "vat_amount": 0,
  "items": [
    {"description": "Backend development", "quantity": 1, "unit_price": 3000000, "tax_amount": 0},
    {"description": "Frontend development", "quantity": 1, "unit_price": 2000000, "tax_amount": 0}
  ]
}
```

### Payment Service (`/api/payments/*`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/api/payments` | Yes | — | List payments |
| POST | `/api/payments` | Yes | invoice:pay | Initiate payment (Idempotency-Key header required) |
| GET | `/api/payments/:id` | Yes | — | Get detail |
| GET | `/api/payments/by-invoice/:invoiceId` | Yes | — | Payments for an invoice |
| POST | `/api/payments/:id/approve` | Yes | payment:approve | Approve payment |
| POST | `/api/payments/:id/reject` | Yes | payment:approve | Reject payment |

**Initiate Payment Example:**
```json
POST /api/payments
Headers: { "Idempotency-Key": "unique-key-123" }
{
  "invoice_id": "uuid-of-invoice",
  "payer_account": "2001000001",
  "amount": 5000000,
  "currency": "MNT"
}
```

### Notification Service (`/api/notifications/*`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | Yes | List notifications |
| GET | `/api/notifications/unread-count` | Yes | Unread count |
| PATCH | `/api/notifications/:id/read` | Yes | Mark as read |
| POST | `/api/notifications/mark-all-read` | Yes | Mark all as read |

### Audit Service (`/api/audit/*`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/api/audit/logs` | Yes | report:view | Audit logs |
| GET | `/api/audit/integration-logs` | Yes | report:view | Integration logs |

### Mock Finacle (`:4010`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/finacle/accounts/validate` | Validate account `{account_no}` |
| POST | `/finacle/accounts/balance` | Check balance `{account_no}` |
| POST | `/finacle/transfer` | Fund transfer `{debit_account, credit_account, amount, currency, reference}` |
| GET | `/finacle/transactions/:ref` | Get transaction status |

### Mock e-Invoice (`:4011`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/einvoice/invoices` | Register invoice |
| GET | `/einvoice/invoices/:ref/status` | Get status |
| PUT | `/einvoice/invoices/:ref/cancel` | Cancel invoice |

---

## Frontend Pages

| Page | URL | Access | Description |
|------|-----|--------|-------------|
| Login | `/login` | Public | Login form |
| Dashboard | `/` | Authenticated | Statistics, recent invoices |
| Invoices | `/invoices` | Authenticated | Sent/Received tabs, filter, pagination |
| Create Invoice | `/invoices/create` | MAKER, ADMIN | Form with dynamic line items |
| Invoice Detail | `/invoices/:id` | Authenticated | Info, items, status history, actions |
| Payments | `/payments` | Authenticated | Payment list, filter |
| Make Payment | `/payments/new` | USER, ADMIN | Select account, enter amount |
| Payment Detail | `/payments/:id` | Authenticated | Detail with Finacle ref |
| Notifications | `/notifications` | Authenticated | Read/unread notifications |
| Audit Log | `/audit` | ADMIN, OPERATOR | Audit + integration logs |
| Admin | `/admin` | ADMIN | User and organization management |
| Documentation | `/docs` | Authenticated | System guide and diagrams |

---

## Demo Scenarios

### Scenario 1: Send and Pay Invoice

1. Login as `maker_a` → Invoices → Create Invoice
2. Select receiver: "Ulaanbaatar Trade LLC", add items → Create and Send
3. Login as `user_b` → Invoices → Received tab → Click "Pay"
4. Select account (2001000001 MNT) → Make Payment
5. Payments → List shows PAID with Finacle txn ref

### Scenario 2: Bidirectional Invoicing

1. `maker_a` → Send invoice to Org B
2. `maker_b` → Send invoice to Org A
3. Each org receives and pays

### Scenario 3: Cancel Invoice

1. `maker_a` → Create invoice → Send
2. Open invoice detail → Click "Cancel" → Enter reason
3. Status: CANCEL_REQUESTED

### Scenario 4: Admin Panel

1. Login as `admin`
2. Admin → Users (all 8), Organizations (with account details)
3. Audit Log → Full action history

---

## Running Tests

```bash
# Full API endpoint tests (55 tests)
bash scripts/test-all-endpoints.sh
```

---

## Project Structure

```
m-bank/
├── packages/                    # Shared libraries
│   ├── shared-types/            # TypeScript types, enums, events
│   ├── shared-utils/            # Logger, errors, correlation, pagination
│   └── shared-middleware/       # Auth, error handler middleware
├── services/
│   ├── api-gateway/             # Routing, JWT, rate limit
│   ├── auth-service/            # Authentication, RBAC
│   ├── invoice-service/         # Invoice CRUD, state machine
│   ├── payment-service/         # Payment processing
│   ├── notification-service/    # Notifications
│   ├── audit-service/           # Audit logging
│   ├── integration-service/     # External system adapters
│   ├── mock-finacle/            # Core Banking simulator
│   ├── mock-einvoice/           # e-Invoice simulator
│   └── unified-server/          # Single-process server for deployment
├── frontend/                    # React SPA
├── scripts/
│   ├── run-all.sh               # Start all services
│   ├── seed-db.ts               # Insert test data
│   └── test-all-endpoints.sh    # API tests (55 tests)
├── docs/
│   ├── README.md                # This file
│   ├── diagrams.md              # System diagrams
│   └── DEPLOY.md                # Deployment guide
├── docker-compose.yml
├── render.yaml                  # Render deploy config
└── package.json                 # npm workspaces root
```
