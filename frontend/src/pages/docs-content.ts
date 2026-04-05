export const README_CONTENT = `
# M-Bank: Inter-Bank Invoice Exchange System

## Overview

A secure and reliable system for organizations using internet banking to create, send, receive, pay, and cancel invoices between each other.

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Express + TypeScript (9 microservices) |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Database | PostgreSQL 16 (database-per-service) |
| Queue | Redis 7 + BullMQ (async messaging) |
| External | Mock Finacle (Core Banking) + Mock e-Invoice |

## Test Users

| Username | Password | Role | Organization |
|---|---|---|---|
| maker_a | password123 | Corporate Maker | Mongol Technology LLC |
| user_a | password123 | Corporate User | Mongol Technology LLC |
| approver_a | password123 | Corporate Approver | Mongol Technology LLC |
| maker_b | password123 | Corporate Maker | Ulaanbaatar Trade LLC |
| user_b | password123 | Corporate User | Ulaanbaatar Trade LLC |
| approver_b | password123 | Corporate Approver | Ulaanbaatar Trade LLC |
| admin | password123 | System Admin | — |
| operator | password123 | Bank Operator | — |

## Test Accounts (Mock Finacle)

| Account No | Organization | Currency | Balance |
|---|---|---|---|
| 1001000001 | Mongol Technology LLC | MNT | 50,000,000 |
| 1001000002 | Mongol Technology LLC | USD | 100,000 |
| 2001000001 | Ulaanbaatar Trade LLC | MNT | 30,000,000 |
| 2001000002 | Ulaanbaatar Trade LLC | USD | 50,000 |

## Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| **CORPORATE_MAKER** | Create, send, view invoices |
| **CORPORATE_USER** | View invoices, make payments |
| **CORPORATE_APPROVER** | Approve payments, cancel invoices |
| **BANK_OPERATOR** | View audit logs, reports |
| **SYSTEM_ADMIN** | Full access + admin panel |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Login with credentials |
| POST | /api/auth/refresh | Refresh access token |
| POST | /api/auth/logout | Logout and revoke token |

### Invoices
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/invoices?direction=sent | List sent invoices |
| GET | /api/invoices?direction=received | List received invoices |
| POST | /api/invoices | Create new invoice |
| GET | /api/invoices/:id | Get invoice detail with items |
| POST | /api/invoices/:id/send | Send invoice to receiver |
| POST | /api/invoices/:id/view | Mark as viewed by receiver |
| POST | /api/invoices/:id/cancel | Request cancellation |
| GET | /api/invoices/:id/history | Get status change history |
| GET | /api/invoices/stats | Dashboard statistics |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/payments | List payments |
| POST | /api/payments | Initiate payment (Idempotency-Key header required) |
| GET | /api/payments/:id | Get payment detail |
| GET | /api/payments/by-invoice/:id | Get payments for an invoice |
| POST | /api/payments/:id/approve | Approve payment |
| POST | /api/payments/:id/reject | Reject payment |

### Other
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/organizations | List organizations |
| GET | /api/organizations/:id/accounts | List accounts |
| GET | /api/notifications | List notifications |
| GET | /api/audit/logs | Audit logs (admin only) |
| GET | /api/users | List users |

## Invoice Status Lifecycle

| Status | Description |
|---|---|
| DRAFT | Draft — can be edited or deleted |
| VERIFIED | Verified automatically before sending |
| SENT | Sent to receiver organization |
| RECEIVED | Delivered to receiver (auto-transition) |
| VIEWED | Viewed by receiver |
| PAYMENT_PENDING | Payment initiated, awaiting processing |
| PAID | Fully paid via Finacle transfer |
| CANCEL_REQUESTED | Cancellation requested by sender |
| CANCELLED | Cancelled |
| FAILED | Payment failed |

## Demo Scenarios

### 1. Send and Pay Invoice
1. Login as **maker_a** — Create invoice — Select receiver org
2. Add line items — Click "Send"
3. Login as **user_b** — View received invoices — Click "Pay"
4. Select payer account — Confirm payment — Status becomes PAID

### 2. Cancel Invoice
1. **maker_a** — Create and send invoice
2. Open invoice detail — Click "Cancel" — Enter reason

### 3. Admin Panel
1. Login as **admin**
2. Admin page — View all 8 users, 2 organizations, account details
`;

export const DIAGRAMS_CONTENT = `
# System Diagrams

## 1. Architecture Overview

${"`"+"``"}
┌──────────┐     ┌─────────────┐     ┌──────────────────────────────┐
│ Frontend │────>│ API Gateway │────>│  Auth Service      :4001    │
│ :5173    │     │ :4000       │     │  Invoice Service   :4002    │
└──────────┘     │ JWT verify  │     │  Payment Service   :4003    │
                 │ Rate limit  │     │  Notification Svc  :4004    │
                 │ Proxy route │     │  Audit Service     :4005    │
                 └─────────────┘     │  Integration Svc   :4006    │
                                     └──────────┬─────────────────┘
                                                │ BullMQ (Redis)
                                     ┌──────────┴─────────────────┐
                                     │  Mock Finacle    :4010     │
                                     │  Mock e-Invoice  :4011     │
                                     └────────────────────────────┘
${"`"+"``"}

## 2. Invoice Send Flow

${"`"+"``"}
Org A (Maker)              System                    Org B (User)
    │                         │                          │
    │ POST /invoices          │                          │
    ├────────────────────────>│                          │
    │   <── DRAFT             │                          │
    │                         │                          │
    │ POST /invoices/:id/send │                          │
    ├────────────────────────>│                          │
    │                         │ DRAFT->VERIFIED->SENT    │
    │                         │ SENT->RECEIVED (auto)    │
    │                         │                          │
    │                         │ GET /invoices?received   │
    │                         │<─────────────────────────┤
    │                         │──> invoice list ────────>│
    │                         │                          │
    │                         │ POST /invoices/:id/view  │
    │                         │<─────────────────────────┤
    │                         │ RECEIVED->VIEWED         │
${"`"+"``"}

## 3. Payment Flow

${"`"+"``"}
User (Org B)      Payment Svc    Integration    Mock Finacle
    │                 │               │               │
    │ POST /payments  │               │               │
    ├────────────────>│               │               │
    │                 │ validate acc  │               │
    │                 ├──────────────>│               │
    │                 │               │ POST /finacle │
    │                 │               ├──────────────>│
    │                 │               │<── valid ─────┤
    │                 │<── valid ─────┤               │
    │<─ PENDING ──────┤               │               │
    │                 │               │               │
    │  (async BullMQ) │               │               │
    │                 │──initiated──> │               │
    │                 │               │ check balance │
    │                 │               ├──────────────>│
    │                 │               │ transfer      │
    │                 │               ├──────────────>│
    │                 │               │<── txn_ref ───┤
    │                 │<──result ─────┤               │
    │                 │ update->PAID  │               │
    │                 │               │               │
    │ GET /payments/:id               │               │
    ├────────────────>│               │               │
    │<─ PAID+txn_ref ─┤               │               │
${"`"+"``"}

## 4. Invoice State Machine

${"`"+"``"}
DRAFT -> VERIFIED -> SENT -> RECEIVED -> VIEWED
                                          │
                                PAYMENT_PENDING
                                          │
                              PAYMENT_PROCESSING
                                │         │        │
                             PAID   PARTIALLY   FAILED
                                      _PAID

  SENT/RECEIVED/VIEWED -> CANCEL_REQUESTED -> CANCELLED
${"`"+"``"}

## 5. Inter-Service Communication

### Synchronous (HTTP REST)
| Caller | Target | Purpose |
|---|---|---|
| API Gateway | Auth Service | JWT token verification |
| Invoice Service | Auth Service | Resolve organization name |
| Payment Service | Integration Service | Validate bank account |
| Integration | Mock Finacle | Execute fund transfer |
| Integration | Mock e-Invoice | Register invoice |

### Asynchronous (BullMQ Queues)
| Queue | Producer | Consumer | Purpose |
|---|---|---|---|
| invoice.status-changed | Invoice Svc | Notification, Audit, Integration | On status change |
| payment.initiated | Payment Svc | Integration Svc | Trigger Finacle transfer |
| payment.status-changed | Payment Svc | Invoice, Notification, Audit | On payment result |
| integration.finacle-result | Integration | Payment Svc | Finacle callback |

## 6. Database Schema

| Database | Tables |
|---|---|
| auth_db | organizations, accounts, users, refresh_tokens |
| invoice_db | invoices, invoice_items, invoice_status_history |
| payment_db | payments, idempotency_keys |
| notification_db | notifications |
| audit_db | audit_logs, integration_logs |
| integration_db | integration_outbox |
`;
