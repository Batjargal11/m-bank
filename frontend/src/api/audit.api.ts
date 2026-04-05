import apiClient from './client';

export interface AuditLog {
  readonly id: string;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly user_id: string | null;
  readonly org_id: string | null;
  readonly correlation_id: string;
  readonly old_value: Record<string, unknown> | null;
  readonly new_value: Record<string, unknown> | null;
  readonly ip_address: string | null;
  readonly created_at: string;
}

export interface IntegrationLog {
  readonly id: string;
  readonly target_system: string;
  readonly request_type: string;
  readonly request_url: string | null;
  readonly status: string;
  readonly response_code: number | null;
  readonly error_message: string | null;
  readonly correlation_id: string;
  readonly duration_ms: number | null;
  readonly created_at: string;
}

export const auditApi = {
  getAuditLogs: async (params?: Record<string, string>) => {
    const { data } = await apiClient.get('/audit/logs', { params });
    return data;
  },

  getIntegrationLogs: async (params?: Record<string, string>) => {
    const { data } = await apiClient.get('/audit/integration-logs', { params });
    return data;
  },
} as const;
