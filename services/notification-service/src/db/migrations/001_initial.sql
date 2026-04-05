CREATE TYPE notification_type AS ENUM (
    'INVOICE_RECEIVED','INVOICE_VIEWED','INVOICE_CANCELLED',
    'PAYMENT_RECEIVED','PAYMENT_FAILED','PAYMENT_APPROVED',
    'APPROVAL_REQUIRED','SYSTEM_ALERT'
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_org ON notifications(org_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
