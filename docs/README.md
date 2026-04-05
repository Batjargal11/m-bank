# M-Bank: Интернэт банк хоорондын нэхэмжлэх солилцох систем

## Системийн тойм

Интернэт банк ашиглаж буй байгууллагууд хоорондоо нэхэмжлэх үүсгэх, илгээх, хүлээн авах, төлөх, цуцлах үйлдлүүдийг аюулгүй, найдвартай хэрэгжүүлэх demo систем.

### Технологийн стек

| Бүрэлдэхүүн | Технологи |
|-------------|-----------|
| Backend | Express + TypeScript (microservice бүрт) |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Database | PostgreSQL 16 (service бүрт тусдаа DB) |
| Message Queue | Redis 7 + BullMQ (async messaging) |
| Infra | Docker Compose / Local dev |

---

## Хурдан эхлүүлэх

### Шаардлага

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### Суулгах

```bash
# 1. Clone + Install
cd m-bank
npm install

# 2. Database үүсгэх
for db in auth_db invoice_db payment_db notification_db audit_db integration_db; do
  createdb $db
done

# 3. Shared packages build
npx tsc --project packages/shared-types/tsconfig.json
npx tsc --project packages/shared-utils/tsconfig.json
npx tsc --project packages/shared-middleware/tsconfig.json

# 4. Seed data оруулах
AUTH_DATABASE_URL="postgresql://$(whoami)@localhost:5432/auth_db" npx ts-node scripts/seed-db.ts

# 5. Бүх service эхлүүлэх
bash scripts/run-all.sh

# 6. Frontend эхлүүлэх (шинэ terminal)
cd frontend && npx vite --port 5173
```

### Нэвтрэх

Browser-аар `http://localhost:5173` нээнэ.

| Username | Password | Role | Чадах зүйл |
|----------|----------|------|------------|
| `maker_a` | password123 | CORPORATE_MAKER | Нэхэмжлэх үүсгэх, илгээх |
| `maker_b` | password123 | CORPORATE_MAKER | Нэхэмжлэх үүсгэх, илгээх |
| `user_a` | password123 | CORPORATE_USER | Нэхэмжлэх харах, төлөх |
| `user_b` | password123 | CORPORATE_USER | Нэхэмжлэх харах, төлөх |
| `approver_a` | password123 | CORPORATE_APPROVER | Төлбөр батлах, цуцлах |
| `approver_b` | password123 | CORPORATE_APPROVER | Төлбөр батлах, цуцлах |
| `admin` | password123 | SYSTEM_ADMIN | Бүх эрх + Админ хуудас |
| `operator` | password123 | BANK_OPERATOR | Аудит лог, тайлан |

### Тест байгууллагууд

| Байгууллага | Регистрийн дугаар | MNT данс | USD данс |
|------------|-------------------|----------|----------|
| Монгол Технологи ХХК | REG-001 | 1001000001 (50M) | 1001000002 (100K) |
| Улаанбаатар Худалдаа ХХК | REG-002 | 2001000001 (30M) | 2001000002 (50K) |

---

## Архитектур

### Service-үүд

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

| Service | Port | Зорилго | Database |
|---------|------|---------|----------|
| API Gateway | 4000 | JWT verify, rate limit, proxy routing | — |
| Auth Service | 4001 | Login, RBAC, users, organizations, accounts | auth_db |
| Invoice Service | 4002 | Нэхэмжлэх CRUD, статус удирдлага | invoice_db |
| Payment Service | 4003 | Төлбөр, idempotency, Finacle интеграц | payment_db |
| Notification Service | 4004 | In-app мэдэгдэл, email | notification_db |
| Audit Service | 4005 | Аудит лог, интеграцийн лог | audit_db |
| Integration Service | 4006 | Finacle/e-Invoice adapter, retry queue | integration_db |
| Mock Finacle | 4010 | Core Banking симулятор | in-memory |
| Mock e-Invoice | 4011 | Татварын систем симулятор | in-memory |
| Frontend | 5173 | React SPA | — |

### Харилцааны загвар

**Synchronous (HTTP REST):**
- API Gateway → Auth Service (JWT verify)
- Invoice Service → Auth Service (org нэр авах)
- Payment Service → Integration Service (данс validate)
- Integration Service → Mock Finacle/e-Invoice (гүйлгээ хийх)

**Asynchronous (BullMQ Queue):**
- `invoice.status-changed` → Notification, Audit, Integration
- `payment.initiated` → Integration (Finacle transfer)
- `payment.status-changed` → Invoice (paid_amount update), Notification, Audit
- `integration.finacle-result` → Payment (status update)
- `integration.einvoice-result` → Invoice (ref update)

---

## Бизнес процесс

### 1. Нэхэмжлэх илгээх урсгал

```
Maker (Org A)                       System                        User (Org B)
     │                                │                                │
     │ 1. Нэхэмжлэх үүсгэх (DRAFT)   │                                │
     ├───────────────────────────────►│                                │
     │                                │                                │
     │ 2. Илгээх                      │                                │
     ├───────────────────────────────►│                                │
     │                                │ DRAFT→VERIFIED→SENT→RECEIVED   │
     │                                │                                │
     │                                │ 3. Ирсэн нэхэмжлэх харагдана  │
     │                                │───────────────────────────────►│
     │                                │                                │
     │                                │ 4. Дэлгэрэнгүй харах (VIEWED) │
     │                                │◄───────────────────────────────┤
     │                                │                                │
```

### 2. Төлбөр хийх урсгал

```
User (Org B)          Payment Service     Integration       Mock Finacle
     │                      │                  │                  │
     │ 1. Төлбөр хийх       │                  │                  │
     ├─────────────────────►│                  │                  │
     │                      │ 2. Данс validate │                  │
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

### 3. Нэхэмжлэхийн статус шилжилт

```
DRAFT → VERIFIED → SENT → RECEIVED → VIEWED → PAYMENT_PENDING → PAYMENT_PROCESSING
                                                                        │
                                                      PARTIALLY_PAID ←──┤──► PAID
                                                                        │
                                                                     FAILED
SENT/RECEIVED/VIEWED → CANCEL_REQUESTED → CANCELLED

                                                     EXPIRED (cron job)
```

| Статус | Тайлбар |
|--------|---------|
| DRAFT | Ноорог, засах/устгах боломжтой |
| VERIFIED | Баталгаажсан (автомат) |
| SENT | Илгээгдсэн |
| RECEIVED | Хүлээн авагчид хүрсэн (автомат) |
| VIEWED | Хүлээн авагч үзсэн |
| PAYMENT_PENDING | Төлбөр хүлээгдэж буй |
| PAYMENT_PROCESSING | Finacle-д боловсруулагдаж буй |
| PARTIALLY_PAID | Хэсэгчлэн төлөгдсөн |
| PAID | Бүрэн төлөгдсөн |
| CANCEL_REQUESTED | Цуцлалт хүсэлт |
| CANCELLED | Цуцлагдсан |
| FAILED | Төлбөр амжилтгүй |
| EXPIRED | Хугацаа дууссан |

---

## API Reference

### Auth Service (`/api/auth/*`)

| Method | Endpoint | Auth | Тайлбар |
|--------|----------|------|---------|
| POST | `/api/auth/login` | No | Нэвтрэх `{username, password}` → `{tokens, user}` |
| POST | `/api/auth/refresh` | No | Token шинэчлэх `{refreshToken}` |
| POST | `/api/auth/logout` | Yes | Гарах |

### Organizations (`/api/organizations/*`)

| Method | Endpoint | Auth | Тайлбар |
|--------|----------|------|---------|
| GET | `/api/organizations` | Yes | Байгууллагын жагсаалт |
| GET | `/api/organizations/:id` | Yes | Байгууллагын дэлгэрэнгүй |
| GET | `/api/organizations/:id/accounts` | Yes | Дансны жагсаалт |

### Users (`/api/users/*`)

| Method | Endpoint | Auth | Тайлбар |
|--------|----------|------|---------|
| GET | `/api/users` | Yes | Хэрэглэгчийн жагсаалт (admin бол бүгд) |

### Invoice Service (`/api/invoices/*`)

| Method | Endpoint | Auth | Permission | Тайлбар |
|--------|----------|------|------------|---------|
| GET | `/api/invoices?direction=sent\|received` | Yes | — | Нэхэмжлэхийн жагсаалт |
| GET | `/api/invoices/stats` | Yes | — | Dashboard статистик |
| POST | `/api/invoices` | Yes | invoice:create | Нэхэмжлэх үүсгэх |
| GET | `/api/invoices/:id` | Yes | invoice:view | Дэлгэрэнгүй |
| PUT | `/api/invoices/:id` | Yes | invoice:create | DRAFT засах |
| DELETE | `/api/invoices/:id` | Yes | invoice:create | DRAFT устгах |
| POST | `/api/invoices/:id/send` | Yes | invoice:send | Илгээх |
| POST | `/api/invoices/:id/view` | Yes | invoice:view | Үзсэн тэмдэглэх |
| POST | `/api/invoices/:id/cancel` | Yes | — | Цуцлах хүсэлт |
| GET | `/api/invoices/:id/history` | Yes | invoice:view | Статусын түүх |

**Нэхэмжлэх үүсгэх жишээ:**
```json
POST /api/invoices
{
  "invoice_no": "INV-2026-001",
  "receiver_org_id": "b0000000-0000-0000-0000-000000000002",
  "issue_date": "2026-03-31",
  "due_date": "2026-04-30",
  "currency": "MNT",
  "vat_amount": 500000,
  "notes": "Вэб хөгжүүлэлтийн нэхэмжлэх",
  "items": [
    {"description": "Back-end хөгжүүлэлт", "quantity": 1, "unit_price": 3000000, "tax_amount": 300000},
    {"description": "Front-end хөгжүүлэлт", "quantity": 1, "unit_price": 2000000, "tax_amount": 200000}
  ]
}
```

### Payment Service (`/api/payments/*`)

| Method | Endpoint | Auth | Permission | Тайлбар |
|--------|----------|------|------------|---------|
| GET | `/api/payments` | Yes | — | Төлбөрийн жагсаалт |
| POST | `/api/payments` | Yes | invoice:pay | Төлбөр хийх (Idempotency-Key header шаардлагатай) |
| GET | `/api/payments/:id` | Yes | — | Дэлгэрэнгүй |
| GET | `/api/payments/by-invoice/:invoiceId` | Yes | — | Нэхэмжлэхийн төлбөрүүд |
| POST | `/api/payments/:id/approve` | Yes | payment:approve | Батлах |
| POST | `/api/payments/:id/reject` | Yes | payment:approve | Татгалзах |

**Төлбөр хийх жишээ:**
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

| Method | Endpoint | Auth | Тайлбар |
|--------|----------|------|---------|
| GET | `/api/notifications` | Yes | Мэдэгдлийн жагсаалт |
| GET | `/api/notifications/unread-count` | Yes | Уншаагүй тоо |
| PATCH | `/api/notifications/:id/read` | Yes | Уншсан тэмдэглэх |
| POST | `/api/notifications/mark-all-read` | Yes | Бүгдийг уншсан |

### Audit Service (`/api/audit/*`)

| Method | Endpoint | Auth | Permission | Тайлбар |
|--------|----------|------|------------|---------|
| GET | `/api/audit/logs` | Yes | report:view | Аудит лог |
| GET | `/api/audit/integration-logs` | Yes | report:view | Интеграцийн лог |

### Mock Finacle (`:4010`)

| Method | Endpoint | Тайлбар |
|--------|----------|---------|
| POST | `/finacle/accounts/validate` | Данс шалгах `{account_no}` |
| POST | `/finacle/accounts/balance` | Үлдэгдэл `{account_no}` |
| POST | `/finacle/transfer` | Шилжүүлэг `{debit_account, credit_account, amount, currency, reference}` |
| GET | `/finacle/transactions/:ref` | Гүйлгээ лавлах |

### Mock e-Invoice (`:4011`)

| Method | Endpoint | Тайлбар |
|--------|----------|---------|
| POST | `/einvoice/invoices` | Нэхэмжлэх бүртгэх |
| GET | `/einvoice/invoices/:ref/status` | Статус |
| PUT | `/einvoice/invoices/:ref/cancel` | Цуцлах |

---

## Frontend хуудаснууд

| Хуудас | URL | Эрх | Тайлбар |
|--------|-----|------|---------|
| Нэвтрэх | `/login` | Бүгд | Login form |
| Dashboard | `/` | Нэвтэрсэн | Статистик, сүүлийн нэхэмжлэхүүд |
| Нэхэмжлэх | `/invoices` | Нэвтэрсэн | Илгээсэн/Ирсэн tab, filter, pagination |
| Нэхэмжлэх үүсгэх | `/invoices/create` | MAKER, ADMIN | Form + dynamic items |
| Нэхэмжлэх дэлгэрэнгүй | `/invoices/:id` | Нэвтэрсэн | Мэдээлэл, items, статус түүх, үйлдлүүд |
| Төлбөр | `/payments` | Нэвтэрсэн | Жагсаалт, filter |
| Төлбөр хийх | `/payments/new` | USER, ADMIN | Данс сонгох, дүн оруулах |
| Төлбөр дэлгэрэнгүй | `/payments/:id` | Нэвтэрсэн | Дэлгэрэнгүй, Finacle ref |
| Мэдэгдэл | `/notifications` | Нэвтэрсэн | Жагсаалт, уншсан/уншаагүй |
| Аудит лог | `/audit` | ADMIN, OPERATOR | Аудит + интеграцийн лог |
| Админ | `/admin` | ADMIN | Хэрэглэгч, байгууллага удирдлага |

---

## Demo сценари

### Сценари 1: Нэхэмжлэх илгээж төлөх

1. `maker_a`-аар нэвтрэх → Нэхэмжлэх → Нэхэмжлэх үүсгэх
2. Хүлээн авагч: "Улаанбаатар Худалдаа ХХК", items нэмэх → Үүсгэж илгээх
3. `user_b`-аар нэвтрэх → Нэхэмжлэх → Ирсэн tab → "Төлөх" товч
4. Данс сонгох (2001000001 MNT) → Төлбөр хийх
5. Төлбөр → Жагсаалтад PAID, Finacle txn ref харагдана

### Сценари 2: Хоёр чиглэлд нэхэмжлэх

1. `maker_a` → Org B руу нэхэмжлэх илгээх
2. `maker_b` → Org A руу нэхэмжлэх илгээх
3. Тус тус хүлээн авч, төлбөр хийх

### Сценари 3: Нэхэмжлэх цуцлах

1. `maker_a` → Нэхэмжлэх үүсгэх → Илгээх
2. Нэхэмжлэхийн дэлгэрэнгүй → "Цуцлах" → Шалтгаан бичих
3. Статус: CANCEL_REQUESTED

### Сценари 4: Админ хяналт

1. `admin`-аар нэвтрэх
2. Админ → Хэрэглэгчид (8 user бүгд), Байгууллагууд (данс харах)
3. Аудит лог → Бүх үйлдлийн түүх

---

## Тест ажиллуулах

```bash
# Бүх API endpoint тест (55 тест)
bash scripts/test-all-endpoints.sh
```

---

## Файлын бүтэц

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
│   └── mock-einvoice/           # e-Invoice simulator
├── frontend/                    # React SPA
├── scripts/
│   ├── run-all.sh               # Бүх service эхлүүлэх
│   ├── seed-db.ts               # Test data оруулах
│   └── test-all-endpoints.sh    # API тест (55 тест)
├── docs/
│   ├── README.md                # Энэ файл
│   └── diagrams.md              # Системийн диаграмууд
├── docker-compose.yml           # Docker Compose тохиргоо
└── package.json                 # npm workspaces root
```
