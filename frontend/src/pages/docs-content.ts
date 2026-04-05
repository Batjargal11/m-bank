export const README_CONTENT = `
# M-Bank: Нэхэмжлэх солилцох систем

## Системийн тойм

Интернэт банк ашиглаж буй байгууллагууд хоорондоо нэхэмжлэх үүсгэх, илгээх, хүлээн авах, төлөх, цуцлах үйлдлүүдийг аюулгүй, найдвартай хэрэгжүүлэх систем.

## Технологийн стек

| Бүрэлдэхүүн | Технологи |
|---|---|
| Backend | Express + TypeScript (9 microservice) |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Database | PostgreSQL 16 (service бүрт тусдаа DB) |
| Queue | Redis 7 + BullMQ (async messaging) |
| External | Mock Finacle (Core Banking) + Mock e-Invoice |

## Тест хэрэглэгчид

| Username | Нууц үг | Эрх | Байгууллага |
|---|---|---|---|
| maker_a | password123 | Мэйкер | Монгол Технологи ХХК |
| user_a | password123 | Хэрэглэгч | Монгол Технологи ХХК |
| approver_a | password123 | Батлагч | Монгол Технологи ХХК |
| maker_b | password123 | Мэйкер | Улаанбаатар Худалдаа ХХК |
| user_b | password123 | Хэрэглэгч | Улаанбаатар Худалдаа ХХК |
| approver_b | password123 | Батлагч | Улаанбаатар Худалдаа ХХК |
| admin | password123 | Систем Админ | — |
| operator | password123 | Банк Оператор | — |

## Тест дансууд (Mock Finacle)

| Данс | Байгууллага | Валют | Үлдэгдэл |
|---|---|---|---|
| 1001000001 | Монгол Технологи ХХК | MNT | 50,000,000 |
| 1001000002 | Монгол Технологи ХХК | USD | 100,000 |
| 2001000001 | Улаанбаатар Худалдаа ХХК | MNT | 30,000,000 |
| 2001000002 | Улаанбаатар Худалдаа ХХК | USD | 50,000 |

## Хэрэглэгчийн эрх (RBAC)

| Эрх | Чадах зүйл |
|---|---|
| **CORPORATE_MAKER** | Нэхэмжлэх үүсгэх, илгээх, харах |
| **CORPORATE_USER** | Нэхэмжлэх харах, төлбөр хийх |
| **CORPORATE_APPROVER** | Төлбөр батлах, нэхэмжлэх цуцлах |
| **BANK_OPERATOR** | Аудит лог, тайлан харах |
| **SYSTEM_ADMIN** | Бүх эрх + Админ хяналт |

## API Endpoints

### Auth
| Method | Endpoint | Тайлбар |
|---|---|---|
| POST | /api/auth/login | Нэвтрэх |
| POST | /api/auth/refresh | Token шинэчлэх |
| POST | /api/auth/logout | Гарах |

### Нэхэмжлэх
| Method | Endpoint | Тайлбар |
|---|---|---|
| GET | /api/invoices?direction=sent | Илгээсэн жагсаалт |
| GET | /api/invoices?direction=received | Ирсэн жагсаалт |
| POST | /api/invoices | Үүсгэх |
| GET | /api/invoices/:id | Дэлгэрэнгүй |
| POST | /api/invoices/:id/send | Илгээх |
| POST | /api/invoices/:id/view | Үзсэн тэмдэглэх |
| POST | /api/invoices/:id/cancel | Цуцлах |
| GET | /api/invoices/:id/history | Статус түүх |
| GET | /api/invoices/stats | Dashboard статистик |

### Төлбөр
| Method | Endpoint | Тайлбар |
|---|---|---|
| GET | /api/payments | Жагсаалт |
| POST | /api/payments | Төлбөр хийх (Idempotency-Key header) |
| GET | /api/payments/:id | Дэлгэрэнгүй |
| GET | /api/payments/by-invoice/:id | Нэхэмжлэхийн төлбөрүүд |
| POST | /api/payments/:id/approve | Батлах |
| POST | /api/payments/:id/reject | Татгалзах |

### Бусад
| Method | Endpoint | Тайлбар |
|---|---|---|
| GET | /api/organizations | Байгууллагууд |
| GET | /api/notifications | Мэдэгдлүүд |
| GET | /api/audit/logs | Аудит лог |
| GET | /api/users | Хэрэглэгчид |

## Нэхэмжлэхийн статус

| Статус | Тайлбар |
|---|---|
| DRAFT | Ноорог — засах, устгах боломжтой |
| VERIFIED | Баталгаажсан (автомат) |
| SENT | Илгээгдсэн |
| RECEIVED | Хүлээн авагчид хүрсэн (автомат) |
| VIEWED | Хүлээн авагч үзсэн |
| PAYMENT_PENDING | Төлбөр хүлээгдэж буй |
| PAID | Бүрэн төлөгдсөн |
| CANCEL_REQUESTED | Цуцлалт хүсэлт |
| CANCELLED | Цуцлагдсан |
| FAILED | Амжилтгүй |

## Demo сценари

### 1. Нэхэмжлэх илгээж төлөх
1. **maker_a**-аар нэвтрэх → Нэхэмжлэх → Нэхэмжлэх үүсгэх
2. Хүлээн авагч: "Улаанбаатар Худалдаа ХХК" сонгох
3. Items нэмэх → Үүсгэж илгээх
4. **user_b**-аар нэвтрэх → Ирсэн нэхэмжлэх → "Төлөх"
5. Данс сонгох → Төлбөр хийх → PAID болно

### 2. Нэхэмжлэх цуцлах
1. **maker_a** → Нэхэмжлэх үүсгэх → Илгээх
2. Дэлгэрэнгүй → "Цуцлах" → Шалтгаан бичих

### 3. Админ хяналт
1. **admin**-аар нэвтрэх
2. Админ → 8 хэрэглэгч, 2 байгууллага, дансны мэдээлэл
`;

export const DIAGRAMS_CONTENT = `
# Системийн диаграмууд

## 1. Ерөнхий архитектур

\`\`\`
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
\`\`\`

## 2. Нэхэмжлэх илгээх урсгал

\`\`\`
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
\`\`\`

## 3. Төлбөр хийх урсгал

\`\`\`
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
\`\`\`

## 4. Статус шилжилт (State Machine)

\`\`\`
DRAFT -> VERIFIED -> SENT -> RECEIVED -> VIEWED
                                          │
                                PAYMENT_PENDING
                                          │
                              PAYMENT_PROCESSING
                                │         │        │
                             PAID   PARTIALLY   FAILED
                                      _PAID

  SENT/RECEIVED/VIEWED -> CANCEL_REQUESTED -> CANCELLED
\`\`\`

## 5. Микросервис харилцаа

### Synchronous (HTTP)
| Дуудагч | Хүлээн авагч | Зорилго |
|---|---|---|
| API Gateway | Auth Service | JWT баталгаажуулалт |
| Invoice Service | Auth Service | Байгууллагын нэр авах |
| Payment Service | Integration Service | Данс шалгах |
| Integration | Mock Finacle | Гүйлгээ хийх |
| Integration | Mock e-Invoice | Нэхэмжлэх бүртгэх |

### Asynchronous (BullMQ)
| Queue | Producer | Consumer | Зорилго |
|---|---|---|---|
| invoice.status-changed | Invoice | Notification, Audit, Integration | Статус өөрчлөгдөхөд |
| payment.initiated | Payment | Integration | Finacle руу гүйлгээ |
| payment.status-changed | Payment | Invoice, Notification, Audit | Төлбөр хийгдэхэд |
| integration.finacle-result | Integration | Payment | Finacle хариу |

## 6. Database бүтэц

| Database | Хүснэгтүүд |
|---|---|
| auth_db | organizations, accounts, users, refresh_tokens |
| invoice_db | invoices, invoice_items, invoice_status_history |
| payment_db | payments, idempotency_keys |
| notification_db | notifications |
| audit_db | audit_logs, integration_logs |
| integration_db | integration_outbox |
`;
