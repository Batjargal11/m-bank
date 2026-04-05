# M-Bank System Diagrams

## 1. Системийн ерөнхий архитектур

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React SPA)                         │
│                        http://localhost:5173                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP (Vite Proxy)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (:4000)                            │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ JWT Auth │  │Rate Limit│  │Correlation │  │  Proxy Routing   │  │
│  │Middleware│  │ (Redis)  │  │  ID Gen    │  │ /api/* → service │  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────────────┘  │
└───┬────────┬────────┬────────┬────────┬────────┬───────────────────┘
    │        │        │        │        │        │
    ▼        ▼        ▼        ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ Auth │ │Invoic│ │Paymt │ │Notif │ │Audit │ │Integ │
│:4001 │ │:4002 │ │:4003 │ │:4004 │ │:4005 │ │:4006 │
└──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
   │        │        │        │        │        │
   ▼        ▼        ▼        ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│auth  │ │invoic│ │paymt │ │notif │ │audit │ │integ │
│ _db  │ │e_db  │ │ _db  │ │ _db  │ │ _db  │ │ _db  │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
              PostgreSQL (:5432)

    ┌─────────────────────────────────┐
    │     Redis + BullMQ (:6379)      │
    │  ┌───────────────────────────┐  │
    │  │ Queues:                   │  │
    │  │ • invoice.status-changed  │  │
    │  │ • payment.initiated       │  │
    │  │ • payment.status-changed  │  │
    │  │ • integration.finacle    │  │
    │  │ • integration.einvoice   │  │
    │  │ • audit.log              │  │
    │  │ • notification.send      │  │
    │  └───────────────────────────┘  │
    └─────────────────────────────────┘

    ┌──────────────────┐  ┌──────────────────┐
    │  Mock Finacle    │  │  Mock e-Invoice  │
    │  (Core Banking)  │  │  (Татварын систем)│
    │     :4010        │  │     :4011        │
    └──────────────────┘  └──────────────────┘
```

## 2. Нэхэмжлэх илгээх урсгал (Invoice Send Flow)

```
 Org A (Илгээгч)                    System                         Org B (Хүлээн авагч)
 ═══════════════                    ══════                         ═══════════════════
      │                                │                                    │
      │  1. Нэхэмжлэх үүсгэх          │                                    │
      │  POST /api/invoices            │                                    │
      ├───────────────────────────────►│                                    │
      │                                │                                    │
      │  ◄─ invoice (DRAFT)            │                                    │
      │                                │                                    │
      │  2. Илгээх                     │                                    │
      │  POST /api/invoices/:id/send   │                                    │
      ├───────────────────────────────►│                                    │
      │                                │  ┌────────────────────┐            │
      │                                │  │ DRAFT → VERIFIED   │            │
      │                                │  │ VERIFIED → SENT    │            │
      │                                │  │ SENT → RECEIVED    │            │
      │                                │  │ (auto-transition)  │            │
      │                                │  └────────────────────┘            │
      │                                │                                    │
      │                                │──── BullMQ ────────────────────────│
      │                                │  invoice.status-changed            │
      │                                │         │                          │
      │                                │    ┌────┴──────────┐               │
      │                                │    ▼               ▼               │
      │                                │ [e-Invoice      [Notification      │
      │                                │  Sync]           Service]          │
      │                                │    │               │               │
      │                                │    ▼               ▼               │
      │                                │ Mock e-Invoice  Мэдэгдэл ────────►│
      │                                │  EINV-xxx       "Нэхэмжлэх ирлээ" │
      │                                │                                    │
      │  ◄─ invoice (RECEIVED)         │                                    │
      │                                │                                    │
      │                                │   3. Хүлээн авагч харах            │
      │                                │   GET /api/invoices?received       │
      │                                │◄───────────────────────────────────┤
      │                                │                                    │
      │                                │──► invoice list (DRAFT хасагдсан) ─►│
      │                                │                                    │
      │                                │   4. Дэлгэрэнгүй + Үзсэн         │
      │                                │   POST /api/invoices/:id/view      │
      │                                │◄───────────────────────────────────┤
      │                                │                                    │
      │                                │  RECEIVED → VIEWED                 │
      │                                │──► invoice (VIEWED) ──────────────►│
      │                                │                                    │
```

## 3. Төлбөр хийх урсгал (Payment Flow)

```
 Org B (Төлөгч)          Payment Svc       Integration Svc      Mock Finacle
 ══════════════          ═══════════       ═══════════════      ════════════
      │                       │                   │                   │
      │ 1. POST /api/payments │                   │                   │
      │ {invoice_id,          │                   │                   │
      │  payer_account,       │                   │                   │
      │  amount, currency}    │                   │                   │
      ├──────────────────────►│                   │                   │
      │                       │                   │                   │
      │                       │ 2. Validate       │                   │
      │                       │    account        │                   │
      │                       ├──────────────────►│                   │
      │                       │                   │ 3. POST /finacle  │
      │                       │                   │    /accounts      │
      │                       │                   │    /validate      │
      │                       │                   ├──────────────────►│
      │                       │                   │◄─ valid ──────────┤
      │                       │◄─ valid ──────────┤                   │
      │                       │                   │                   │
      │                       │ 4. Create payment │                   │
      │                       │    record (DB)    │                   │
      │                       │    PAYMENT_PENDING│                   │
      │                       │                   │                   │
      │◄── 202 Accepted ──────┤                   │                   │
      │    {payment_id,       │                   │                   │
      │     PAYMENT_PENDING}  │                   │                   │
      │                       │                   │                   │
      │                       │ 5. BullMQ:        │                   │
      │                       │    payment        │                   │
      │                       │    .initiated     │                   │
      │                       │ ─ ─ ─ ─ ─ ─ ─ ─►│                   │
      │                       │                   │                   │
      │                       │                   │ 6. Check balance  │
      │                       │                   ├──────────────────►│
      │                       │                   │◄─ balance: OK ────┤
      │                       │                   │                   │
      │                       │                   │ 7. POST /finacle  │
      │                       │                   │    /transfer      │
      │                       │                   │ {debit, credit,   │
      │                       │                   │  amount}          │
      │                       │                   ├──────────────────►│
      │                       │                   │                   │
      │                       │                   │  ┌─────────────┐  │
      │                       │                   │  │ Debit Payer │  │
      │                       │                   │  │ Credit Recv │  │
      │                       │                   │  │ Gen txn_ref │  │
      │                       │                   │  └─────────────┘  │
      │                       │                   │                   │
      │                       │                   │◄─ {txn_ref,      ─┤
      │                       │                   │    SUCCESS}       │
      │                       │                   │                   │
      │                       │ 8. BullMQ:        │                   │
      │                       │    finacle.result  │                   │
      │                       │◄─ ─ ─ ─ ─ ─ ─ ─ ┤                   │
      │                       │                   │                   │
      │                       │ 9. Update payment │                   │
      │                       │    → PAID         │                   │
      │                       │    + txn_ref      │                   │
      │                       │                   │                   │
      │                       │ 10. BullMQ:       │                   │
      │                       │     payment       │                   │
      │                       │     .status       │                   │
      │                       │     -changed      │                   │
      │                       │ ─ ─ ─ ─ ─ ─ ─ ─►│                   │
      │                       │       │           │                   │
      │                       │  ┌────┴────┐      │                   │
      │                       │  ▼         ▼      │                   │
      │                       │ Invoice  Notif    │                   │
      │                       │ Service  Service  │                   │
      │                       │  │         │      │                   │
      │                       │  ▼         ▼      │                   │
      │                       │ Update   Send     │                   │
      │                       │ paid_amt notif    │                   │
      │                       │                   │                   │
      │ 11. GET /payments/:id │                   │                   │
      ├──────────────────────►│                   │                   │
      │◄── PAID, txn_ref ─────┤                   │                   │
      │                       │                   │                   │
```

## 4. Нэхэмжлэхийн статус шилжилт (Invoice State Machine)

```
                          ┌──────────┐
                          │  DRAFT   │
                          └────┬─────┘
                               │ verify + send
                          ┌────▼─────┐
                          │ VERIFIED │
                          └────┬─────┘
                               │ send
                          ┌────▼─────┐
              ┌───────────┤   SENT   ├──────────────┐
              │           └────┬─────┘              │
              │ cancel         │ auto               │
              │           ┌────▼─────┐              │
              │     ┌─────┤ RECEIVED ├─────┐        │
              │     │     └────┬─────┘     │        │
              │     │ cancel   │ view      │        │
              │     │     ┌────▼─────┐     │        │
              │     │  ┌──┤  VIEWED  ├──┐  │        │
              │     │  │  └────┬─────┘  │  │        │
              │     │  │cancel │ pay    │  │        │
              │     │  │  ┌────▼──────┐ │  │        │
              │     │  │  │ PAYMENT   │ │  │        │
              │     │  │  │ _PENDING  │ │  │        │
              │     │  │  └────┬──────┘ │  │        │
              │     │  │       │process │  │        │
              │     │  │  ┌────▼──────┐ │  │        │
              │     │  │  │ PAYMENT   │ │  │        │
              │     │  │  │_PROCESSING│ │  │        │
              │     │  │  └──┬──┬──┬──┘ │  │        │
              │     │  │     │  │  │    │  │        │
              ▼     ▼  ▼     │  │  │    │  │        │
         ┌──────────────┐    │  │  │    │  │        │
         │   CANCEL     │    │  │  └────┘  │        │
         │  _REQUESTED  │    │  │  fail    │        │
         └──────┬───────┘    │  │          │        │
                │            │  │     ┌────▼──────┐ │
                ▼            │  │     │  FAILED   │ │
         ┌───────────┐       │  │     └───────────┘ │
         │ CANCELLED │       │  │                   │
         └───────────┘       │  │                   │
                             │  ▼                   │
                             │ ┌──────────────┐     │
                             │ │ PARTIALLY    │     │
                             │ │    _PAID     │     │
                             │ └──────┬───────┘     │
                             │        │             │
                             ▼        ▼             │
                        ┌──────────────┐            │
                        │     PAID     │            │
                        └──────────────┘            │
                                                    │
                        ┌──────────────┐            │
                        │   EXPIRED    │◄───────────┘
                        └──────────────┘  (cron job)
```

## 5. Микросервис хоорондын харилцаа (Inter-Service Communication)

```
┌──────────────────────────────────────────────────────────────────┐
│                    SYNCHRONOUS (HTTP REST)                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  API Gateway ──JWT verify──► Auth Service                        │
│                                                                  │
│  Invoice Svc ──get org name──► Auth Service /internal/orgs/:id   │
│                                                                  │
│  Payment Svc ──validate acc──► Integration /internal/finacle/*   │
│                                                                  │
│  Integration ──transfer──► Mock Finacle /finacle/transfer        │
│  Integration ──register──► Mock e-Invoice /einvoice/invoices     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   ASYNCHRONOUS (BullMQ + Redis)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    invoice.status-changed    ┌───────────────┐  │
│  │ Invoice Svc │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►│ Notification  │  │
│  │             │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►│ Audit Service │  │
│  │             │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►│ Integration   │  │
│  └─────────────┘                              └───────────────┘  │
│                                                                  │
│  ┌─────────────┐    payment.initiated         ┌───────────────┐  │
│  │ Payment Svc │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►│ Integration   │  │
│  └─────────────┘                              │ (Finacle call)│  │
│                                               └───────┬───────┘  │
│                                                       │          │
│  ┌─────────────┐    integration.finacle-result │      │          │
│  │ Payment Svc │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘      │          │
│  └──────┬──────┘                                      │          │
│         │                                             │          │
│         │            payment.status-changed            │          │
│         └ ─ ─ ─ ─ ─►┌───────────────┐                │          │
│                      │ Invoice Svc   │ (update paid)  │          │
│                      │ Notification  │ (send alert)   │          │
│                      │ Audit Service │ (log entry)    │          │
│                      └───────────────┘                │          │
│                                                       │          │
│  ┌─────────────┐    integration.einvoice-result       │          │
│  │ Invoice Svc │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘          │
│  │(update ref) │                                                 │
│  └─────────────┘                                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 6. Хэрэглэгчийн эрхийн бүтэц (RBAC)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLE-BASED ACCESS CONTROL                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CORPORATE_MAKER (maker_a, maker_b)                             │
│  ├── invoice:create   ← Нэхэмжлэх үүсгэх                      │
│  ├── invoice:send     ← Нэхэмжлэх илгээх                       │
│  ├── invoice:view     ← Нэхэмжлэх харах                        │
│  └── payment:read     ← Төлбөр харах                            │
│                                                                 │
│  CORPORATE_USER (user_a, user_b)                                │
│  ├── invoice:view     ← Нэхэмжлэх харах                        │
│  ├── invoice:pay      ← Нэхэмжлэх төлөх                        │
│  └── payment:read     ← Төлбөр харах                            │
│                                                                 │
│  CORPORATE_APPROVER (approver_a, approver_b)                    │
│  ├── invoice:view     ← Нэхэмжлэх харах                        │
│  ├── invoice:cancel   ← Нэхэмжлэх цуцлах                      │
│  ├── payment:approve  ← Төлбөр батлах                           │
│  └── payment:read     ← Төлбөр харах                            │
│                                                                 │
│  BANK_OPERATOR (operator)                                       │
│  ├── invoice:view     ← Нэхэмжлэх харах                        │
│  ├── audit:read       ← Аудит лог харах                         │
│  └── report:view      ← Тайлан харах                            │
│                                                                 │
│  SYSTEM_ADMIN (admin)                                           │
│  └── * (бүх эрх)      ← Бүх үйлдэл хийх                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 7. Database бүтэц (Entity Relationship)

```
┌──── auth_db ────────────────────────────────────────────────┐
│                                                             │
│  organizations ──────────< accounts                         │
│  │ org_id (PK)             │ account_id (PK)                │
│  │ name                    │ org_id (FK)                    │
│  │ registration_no         │ account_no                     │
│  │ is_active               │ currency                       │
│  │                         │ is_active                      │
│  ▼                                                          │
│  users ──────────< refresh_tokens                           │
│  │ user_id (PK)    │ token_id (PK)                          │
│  │ org_id (FK)     │ user_id (FK)                           │
│  │ username        │ token_hash                             │
│  │ password_hash   │ expires_at                             │
│  │ role            │ revoked                                │
│  │ is_active                                                │
└─────────────────────────────────────────────────────────────┘

┌──── invoice_db ─────────────────────────────────────────────┐
│                                                             │
│  invoices ──────────< invoice_items                         │
│  │ invoice_id (PK)   │ item_id (PK)                        │
│  │ invoice_no        │ invoice_id (FK)                      │
│  │ sender_org_id     │ description                          │
│  │ receiver_org_id   │ quantity                             │
│  │ total_amount      │ unit_price                           │
│  │ paid_amount       │ tax_amount                           │
│  │ status            │ total_price                          │
│  │                                                          │
│  └──────────< invoice_status_history                        │
│               │ id (PK)                                     │
│               │ invoice_id (FK)                             │
│               │ from_status                                 │
│               │ to_status                                   │
│               │ changed_by                                  │
│               │ reason                                      │
└─────────────────────────────────────────────────────────────┘

┌──── payment_db ─────────────────────────────────────────────┐
│                                                             │
│  payments                    idempotency_keys               │
│  │ payment_id (PK)           │ idempotency_key (PK)         │
│  │ invoice_id                │ payment_id (FK)              │
│  │ payer_account             │ response_body                │
│  │ beneficiary_account       │ expires_at                   │
│  │ amount                                                   │
│  │ payment_status                                           │
│  │ finacle_txn_ref                                          │
└─────────────────────────────────────────────────────────────┘
```

## 8. Frontend хуудсын бүтэц (Page Map)

```
                    ┌──────────────────┐
                    │   Login Page     │
                    │  /login          │
                    └────────┬─────────┘
                             │ JWT auth
                    ┌────────▼─────────┐
                    │   App Layout     │
                    │  (Sidebar+Header)│
                    └────────┬─────────┘
                             │
        ┌────────────┬───────┼───────┬────────────┬──────────┐
        ▼            ▼       ▼       ▼            ▼          ▼
   ┌─────────┐ ┌─────────┐ ┌───────┐ ┌──────────┐ ┌──────┐ ┌──────┐
   │Dashboard│ │Invoices │ │Paymts │ │Notificat │ │Audit │ │Admin │
   │  /      │ │/invoices│ │/paymts│ │/notifica │ │/audit│ │/admin│
   └─────────┘ └────┬────┘ └───┬───┘ └──────────┘ └──────┘ └──────┘
                    │          │       (admin+     (admin+   (admin)
               ┌────┴────┐ ┌──┴───┐    operator)  operator)
               ▼         ▼ ▼      ▼
          ┌────────┐ ┌──────┐ ┌──────┐
          │Create  │ │Detail│ │Create│
          │Invoice │ │/:id  │ │Paymt │
          │/create │ │      │ │/new  │
          └────────┘ └──────┘ └──────┘
           (maker)            (user)
```
