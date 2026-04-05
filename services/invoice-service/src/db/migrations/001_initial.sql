CREATE TYPE invoice_status AS ENUM (
    'DRAFT', 'VERIFIED', 'SENT', 'RECEIVED', 'VIEWED',
    'PAYMENT_PENDING', 'PAYMENT_PROCESSING', 'PARTIALLY_PAID',
    'PAID', 'CANCEL_REQUESTED', 'CANCELLED', 'EXPIRED', 'FAILED'
);

CREATE TABLE invoices (
    invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    sender_org_id UUID NOT NULL,
    receiver_org_id UUID NOT NULL,
    sender_org_name VARCHAR(255) NOT NULL,
    receiver_org_name VARCHAR(255) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MNT',
    total_amount DECIMAL(18,2) NOT NULL,
    vat_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    outstanding_amount DECIMAL(18,2) NOT NULL,
    status invoice_status NOT NULL DEFAULT 'DRAFT',
    external_einvoice_ref VARCHAR(100),
    notes TEXT,
    created_by UUID NOT NULL,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(18,2) NOT NULL,
    tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(18,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
    from_status invoice_status,
    to_status invoice_status NOT NULL,
    changed_by UUID NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_sender ON invoices(sender_org_id);
CREATE INDEX idx_invoices_receiver ON invoices(receiver_org_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_status_history_invoice ON invoice_status_history(invoice_id);
