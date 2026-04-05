import apiClient from './client';

export interface PaymentListParams {
  readonly page?: number;
  readonly limit?: number;
  readonly status?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

export interface Payment {
  readonly payment_id: string;
  readonly invoice_id: string;
  readonly invoice_no: string;
  readonly payer_org_id: string;
  readonly payer_account: string;
  readonly beneficiary_org_id: string;
  readonly beneficiary_account: string;
  readonly amount: string;
  readonly currency: string;
  readonly payment_status: string;
  readonly finacle_txn_ref: string | null;
  readonly initiated_by: string;
  readonly approved_by: string | null;
  readonly rejection_reason: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ApiListResponse {
  readonly success: boolean;
  readonly data: readonly Payment[];
  readonly meta?: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
  };
}

export const paymentApi = {
  getPayments: async (params: PaymentListParams): Promise<ApiListResponse> => {
    const { data } = await apiClient.get('/payments', { params });
    return data;
  },

  getPaymentById: async (id: string): Promise<Payment> => {
    const { data } = await apiClient.get(`/payments/${id}`);
    return data.data;
  },

  approvePayment: async (id: string): Promise<Payment> => {
    const { data } = await apiClient.post(`/payments/${id}/approve`);
    return data.data;
  },

  rejectPayment: async (id: string, reason: string): Promise<Payment> => {
    const { data } = await apiClient.post(`/payments/${id}/reject`, { reason });
    return data.data;
  },

  getPaymentsByInvoice: async (invoiceId: string): Promise<readonly Payment[]> => {
    const { data } = await apiClient.get(`/payments/by-invoice/${invoiceId}`);
    return data.data;
  },
} as const;
