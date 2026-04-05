export const README_CONTENT = `
# M-Bank: Inter-Bank Invoice Exchange System

## Overview

Интернэт банк ашиглаж буй байгууллагууд хоорондоо invoice үүсгэх, илгээх, хүлээн авах, төлөх, цуцлах үйлдлүүдийг аюулгүй хэрэгжүүлэх систем.

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
| maker_a | password123 | Corporate Maker | Монгол Технологи ХХК |
| user_a | password123 | Corporate User | Монгол Технологи ХХК |
| approver_a | password123 | Corporate Approver | Монгол Технологи ХХК |
| maker_b | password123 | Corporate Maker | Улаанбаатар Худалдаа ХХК |
| user_b | password123 | Corporate User | Улаанбаатар Худалдаа ХХК |
| approver_b | password123 | Corporate Approver | Улаанбаатар Худалдаа ХХК |
| admin | password123 | System Admin | — |
| operator | password123 | Bank Operator | — |

## Test Accounts (Mock Finacle)

| Account No | Organization | Currency | Balance |
|---|---|---|---|
| 1001000001 | Монгол Технологи ХХК | MNT | 50,000,000 |
| 1001000002 | Монгол Технологи ХХК | USD | 100,000 |
| 2001000001 | Улаанбаатар Худалдаа ХХК | MNT | 30,000,000 |
| 2001000002 | Улаанбаатар Худалдаа ХХК | USD | 50,000 |

## Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| **CORPORATE_MAKER** | Invoice үүсгэх, илгээх, харах |
| **CORPORATE_USER** | Invoice харах, төлбөр хийх |
| **CORPORATE_APPROVER** | Төлбөр approve хийх, invoice cancel хийх |
| **BANK_OPERATOR** | Audit log, report харах |
| **SYSTEM_ADMIN** | Бүх эрх + Admin panel |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Нэвтрэх |
| POST | /api/auth/refresh | Access token шинэчлэх |
| POST | /api/auth/logout | Logout хийх |

### Invoices
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/invoices?direction=sent | Илгээсэн invoice жагсаалт |
| GET | /api/invoices?direction=received | Ирсэн invoice жагсаалт |
| POST | /api/invoices | Шинэ invoice үүсгэх |
| GET | /api/invoices/:id | Invoice detail + items |
| POST | /api/invoices/:id/send | Invoice илгээх |
| POST | /api/invoices/:id/view | Receiver үзсэн гэж тэмдэглэх |
| POST | /api/invoices/:id/cancel | Cancel хүсэлт |
| GET | /api/invoices/:id/history | Status change history |
| GET | /api/invoices/stats | Dashboard statistics |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/payments | Төлбөрийн жагсаалт |
| POST | /api/payments | Төлбөр хийх (Idempotency-Key header шаардлагатай) |
| GET | /api/payments/:id | Төлбөрийн detail |
| GET | /api/payments/by-invoice/:id | Invoice-ийн төлбөрүүд |
| POST | /api/payments/:id/approve | Төлбөр approve хийх |
| POST | /api/payments/:id/reject | Төлбөр reject хийх |

### Other
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/organizations | Байгууллагын жагсаалт |
| GET | /api/organizations/:id/accounts | Account жагсаалт |
| GET | /api/notifications | Notification жагсаалт |
| GET | /api/audit/logs | Audit log (admin only) |
| GET | /api/users | User жагсаалт |

## Invoice Status Lifecycle

| Status | Description |
|---|---|
| DRAFT | Ноорог — засах, устгах боломжтой |
| VERIFIED | Автоматаар verified болсон |
| SENT | Receiver байгууллага руу илгээгдсэн |
| RECEIVED | Receiver-д хүрсэн (auto-transition) |
| VIEWED | Receiver үзсэн |
| PAYMENT_PENDING | Төлбөр хүлээгдэж байна |
| PAID | Бүрэн төлөгдсөн (Finacle transfer) |
| CANCEL_REQUESTED | Sender cancel хүсэлт илгээсэн |
| CANCELLED | Цуцлагдсан |
| FAILED | Төлбөр амжилтгүй |

## Demo Scenarios

### 1. Invoice илгээж төлөх
1. **maker_a**-аар login хийх — Invoice үүсгэх — Receiver org сонгох
2. Line items нэмэх — "Send" дарах
3. **user_b**-аар login хийх — Received invoices — "Pay" дарах
4. Payer account сонгох — Confirm payment — Status PAID болно

### 2. Invoice Cancel хийх
1. **maker_a** — Invoice үүсгэх → Send хийх
2. Invoice detail — "Cancel" дарах — Reason бичих

### 3. Admin Panel
1. **admin**-аар login хийх
2. Admin page — 8 user, 2 organization, account details харах
`;

export const DIAGRAMS_CONTENT = `
# System Diagrams

## 1. Architecture Overview

${'`' + '``'}
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
${'`' + '``'}

## 2. Invoice Send Flow

${'`' + '``'}
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
${'`' + '``'}

## 3. Payment Flow

${'`' + '``'}
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
${'`' + '``'}

## 4. Invoice State Machine

${'`' + '``'}
DRAFT -> VERIFIED -> SENT -> RECEIVED -> VIEWED
                                          │
                                PAYMENT_PENDING
                                          │
                              PAYMENT_PROCESSING
                                │         │        │
                             PAID   PARTIALLY   FAILED
                                      _PAID

  SENT/RECEIVED/VIEWED -> CANCEL_REQUESTED -> CANCELLED
${'`' + '``'}

## 5. Inter-Service Communication

### Synchronous (HTTP REST)
| Caller | Target | Зорилго |
|---|---|---|
| API Gateway | Auth Service | JWT token verification |
| Invoice Service | Auth Service | Байгууллагын нэр авах |
| Payment Service | Integration Service | Account validation |
| Integration | Mock Finacle | Fund transfer хийх |
| Integration | Mock e-Invoice | Invoice бүртгэх |

### Asynchronous (BullMQ Queues)
| Queue | Producer | Consumer | Зорилго |
|---|---|---|---|
| invoice.status-changed | Invoice Svc | Notification, Audit, Integration | Status өөрчлөгдөхөд |
| payment.initiated | Payment Svc | Integration Svc | Finacle transfer trigger |
| payment.status-changed | Payment Svc | Invoice, Notification, Audit | Төлбөр хийгдэхэд |
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
