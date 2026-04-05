export interface AuditLog {
  id: string;
  user_id: string | null;
  org_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string;
  created_at: string;
}

export interface IntegrationLog {
  id: string;
  target_system: string;
  request_type: string;
  request_url: string | null;
  request_body: Record<string, unknown> | null;
  response_code: number | null;
  response_body: Record<string, unknown> | null;
  retry_count: number;
  status: string;
  error_message: string | null;
  correlation_id: string;
  duration_ms: number | null;
  created_at: string;
}

export interface CreateAuditLogDto {
  user_id?: string;
  org_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  correlation_id: string;
}
