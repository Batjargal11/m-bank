CREATE TYPE payment_status AS ENUM ('PAYMENT_PENDING','PAYMENT_PROCESSING','PAID','PARTIALLY_PAID','PAYMENT_FAILED');

CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,
    invoice_no VARCHAR(50) NOT NULL,
    payer_org_id UUID NOT NULL,
    payer_account VARCHAR(50) NOT NULL,
    beneficiary_org_id UUID NOT NULL,
    beneficiary_account VARCHAR(50) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MNT',
    payment_status payment_status NOT NULL DEFAULT 'PAYMENT_PENDING',
    finacle_txn_ref VARCHAR(100),
    initiated_by UUID NOT NULL,
    approved_by UUID,
    rejection_reason TEXT,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_payer ON payments(payer_org_id);
CREATE INDEX idx_payments_status ON payments(payment_status);

CREATE TABLE idempotency_keys (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    payment_id UUID REFERENCES payments(payment_id),
    response_body JSONB,
    status_code INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
