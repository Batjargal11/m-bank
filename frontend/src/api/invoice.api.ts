import apiClient from './client';

export interface InvoiceListParams {
  readonly page?: number;
  readonly limit?: number;
  readonly status?: string;
  readonly direction?: 'sent' | 'received';
  readonly startDate?: string;
  readonly endDate?: string;
}

export interface Invoice {
  readonly invoice_id: string;
  readonly invoice_no: string;
  readonly sender_org_id: string;
  readonly sender_org_name: string;
  readonly receiver_org_id: string;
  readonly receiver_org_name: string;
  readonly status: string;
  readonly issue_date: string;
  readonly due_date: string;
  readonly currency: string;
  readonly total_amount: string;
  readonly vat_amount: string;
  readonly paid_amount: string;
  readonly outstanding_amount: string;
  readonly notes?: string;
  readonly items?: readonly InvoiceItem[];
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly external_einvoice_ref?: string;
}

export interface InvoiceItem {
  readonly item_id: string;
  readonly description: string;
  readonly quantity: string;
  readonly unit_price: string;
  readonly tax_amount: string;
  readonly total_price: string;
}

export interface ApiListResponse {
  readonly success: boolean;
  readonly data: readonly Invoice[];
  readonly meta?: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
  };
}

export const invoiceApi = {
  getInvoices: async (params: InvoiceListParams): Promise<ApiListResponse> => {
    const { data } = await apiClient.get('/invoices', { params });
    return data;
  },

  getInvoiceById: async (id: string): Promise<Invoice> => {
    const { data } = await apiClient.get(`/invoices/${id}`);
    return data.data;
  },

  createInvoice: async (invoiceData: Record<string, unknown>): Promise<Invoice> => {
    const { data } = await apiClient.post('/invoices', invoiceData);
    return data.data;
  },

  sendInvoice: async (id: string): Promise<Invoice> => {
    const { data } = await apiClient.post(`/invoices/${id}/send`);
    return data.data;
  },

  viewInvoice: async (id: string): Promise<Invoice> => {
    const { data } = await apiClient.post(`/invoices/${id}/view`);
    return data.data;
  },

  cancelInvoice: async (id: string, reason: string): Promise<Invoice> => {
    const { data } = await apiClient.post(`/invoices/${id}/cancel`, { reason });
    return data.data;
  },

  deleteInvoice: async (id: string): Promise<void> => {
    await apiClient.delete(`/invoices/${id}`);
  },

  getInvoiceHistory: async (id: string): Promise<readonly Record<string, unknown>[]> => {
    const { data } = await apiClient.get(`/invoices/${id}/history`);
    return data.data;
  },

  getDashboardStats: async (): Promise<Record<string, unknown>> => {
    const { data } = await apiClient.get('/invoices/stats');
    return data.data;
  },
} as const;
