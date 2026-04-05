import { createLogger } from '@m-bank/shared-utils';
import { config } from '../config';

const logger = createLogger('einvoice-adapter');

const TIMEOUT_MS = 5000;

export interface EinvoiceRegisterRequest {
  invoiceNo: string;
  senderOrgId: string;
  receiverOrgId: string;
  amount: number;
  vatAmount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  items: ReadonlyArray<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    totalPrice: number;
  }>;
}

export interface EinvoiceRegisterResponse {
  success: boolean;
  einvoiceRef: string | null;
  status: string;
  errorMessage: string | null;
}

export interface EinvoiceStatusResponse {
  success: boolean;
  einvoiceRef: string;
  status: string;
  errorMessage: string | null;
}

export interface EinvoiceCancelResponse {
  success: boolean;
  einvoiceRef: string;
  status: string;
  errorMessage: string | null;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function registerInvoice(
  invoiceData: EinvoiceRegisterRequest,
): Promise<EinvoiceRegisterResponse> {
  const url = `${config.einvoiceBaseUrl}/einvoice/invoices`;
  logger.info({ invoiceNo: invoiceData.invoiceNo }, 'Registering invoice via e-Invoice');

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData),
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        einvoiceRef: null,
        status: 'ERROR',
        errorMessage: (body as { error?: string }).error || `HTTP ${response.status}`,
      };
    }

    return body as unknown as EinvoiceRegisterResponse;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, invoiceNo: invoiceData.invoiceNo }, 'e-Invoice registerInvoice failed');
    return {
      success: false,
      einvoiceRef: null,
      status: 'ERROR',
      errorMessage: message,
    };
  }
}

export async function getInvoiceStatus(
  ref: string,
): Promise<EinvoiceStatusResponse> {
  const url = `${config.einvoiceBaseUrl}/einvoice/invoices/${ref}/status`;
  logger.info({ ref }, 'Getting invoice status via e-Invoice');

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        einvoiceRef: ref,
        status: 'ERROR',
        errorMessage: (body as { error?: string }).error || `HTTP ${response.status}`,
      };
    }

    return body as unknown as EinvoiceStatusResponse;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, ref }, 'e-Invoice getInvoiceStatus failed');
    return {
      success: false,
      einvoiceRef: ref,
      status: 'ERROR',
      errorMessage: message,
    };
  }
}

export async function cancelInvoice(
  ref: string,
): Promise<EinvoiceCancelResponse> {
  const url = `${config.einvoiceBaseUrl}/einvoice/invoices/${ref}/cancel`;
  logger.info({ ref }, 'Cancelling invoice via e-Invoice');

  try {
    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        einvoiceRef: ref,
        status: 'ERROR',
        errorMessage: (body as { error?: string }).error || `HTTP ${response.status}`,
      };
    }

    return body as unknown as EinvoiceCancelResponse;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, ref }, 'e-Invoice cancelInvoice failed');
    return {
      success: false,
      einvoiceRef: ref,
      status: 'ERROR',
      errorMessage: message,
    };
  }
}
