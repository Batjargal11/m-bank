CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    org_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    correlation_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_org ON audit_logs(org_id);
CREATE INDEX idx_audit_correlation ON audit_logs(correlation_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE integration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_system VARCHAR(50) NOT NULL,
    request_type VARCHAR(100) NOT NULL,
    request_url VARCHAR(500),
    request_body JSONB,
    response_code INTEGER,
    response_body JSONB,
    retry_count INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    correlation_id VARCHAR(100) NOT NULL,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intlog_target ON integration_logs(target_system);
CREATE INDEX idx_intlog_correlation ON integration_logs(correlation_id);
CREATE INDEX idx_intlog_status ON integration_logs(status);
CREATE INDEX idx_intlog_created ON integration_logs(created_at DESC);
