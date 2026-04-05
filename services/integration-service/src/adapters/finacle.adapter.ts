import { createLogger } from '@m-bank/shared-utils';
import { config } from '../config';

const logger = createLogger('finacle-adapter');

const TIMEOUT_MS = 5000;

export interface FinacleValidateAccountResponse {
  success: boolean;
  accountNo: string;
  accountName: string;
  orgName: string;
  currency: string;
  status: string;
  errorMessage: string | null;
}

export interface FinacleBalanceResponse {
  success: boolean;
  accountNo: string;
  availableBalance: number;
  currency: string;
  errorMessage: string | null;
}

export interface FinacleTransferResponse {
  success: boolean;
  txnRef: string | null;
  status: string;
  errorMessage: string | null;
}

export interface FinacleTransactionStatusResponse {
  success: boolean;
  txnRef: string;
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

export async function validateAccount(
  accountNo: string,
): Promise<FinacleValidateAccountResponse> {
  const url = `${config.finacleBaseUrl}/finacle/accounts/validate`;
  logger.info({ accountNo }, 'Validating account via Finacle');

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_no: accountNo }),
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        accountNo,
        accountName: '',
        orgName: '',
        currency: '',
        status: 'ERROR',
        errorMessage: (body as { error?: string }).error || `HTTP ${response.status}`,
      };
    }

    const data = (body as any).data || body;
    return {
      success: true,
      accountNo: data.account_no || data.accountNo || accountNo,
      accountName: data.org_name || data.accountName || '',
      orgName: data.org_name || '',
      currency: data.currency || 'MNT',
      status: data.is_active ? 'ACTIVE' : 'INACTIVE',
      errorMessage: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, accountNo }, 'Finacle validateAccount failed');
    return {
      success: false,
      accountNo,
      accountName: '',
      orgName: '',
      currency: '',
      status: 'ERROR',
      errorMessage: message,
    };
  }
}

export async function checkBalance(
  accountNo: string,
): Promise<FinacleBalanceResponse> {
  const url = `${config.finacleBaseUrl}/finacle/accounts/balance`;
  logger.info({ accountNo }, 'Checking balance via Finacle');

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_no: accountNo }),
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        accountNo,
        availableBalance: 0,
        currency: 'MNT',
        errorMessage: (body as { error?: string }).error || `HTTP ${response.status}`,
      };
    }

    return body as unknown as FinacleBalanceResponse;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, accountNo }, 'Finacle checkBalance failed');
    return {
      success: false,
      accountNo,
      availableBalance: 0,
      currency: 'MNT',
      errorMessage: message,
    };
  }
}

export async function transfer(
  debitAccount: string,
  creditAccount: string,
  amount: number,
  currency: string,
  reference: string,
): Promise<FinacleTransferResponse> {
  const url = `${config.finacleBaseUrl}/finacle/transfer`;
  logger.info({ debitAccount, creditAccount, amount, currency, reference }, 'Executing transfer via Finacle');

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debit_account: debitAccount, credit_account: creditAccount, amount, currency, reference }),
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        txnRef: null,
        status: 'FAILED',
        errorMessage: (body as { error?: string }).error || `HTTP ${response.status}`,
      };
    }

    const data = (body as any).data || body;
    return {
      success: true,
      txnRef: data.txn_ref || data.txnRef || null,
      status: data.status || 'SUCCESS',
      errorMessage: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, reference }, 'Finacle transfer failed');
    return {
      success: false,
      txnRef: null,
      status: 'FAILED',
      errorMessage: message,
    };
  }
}

export async function getTransactionStatus(
  txnRef: string,
): Promise<FinacleTransactionStatusResponse> {
  const url = `${config.finacleBaseUrl}/finacle/transactions/${txnRef}`;
  logger.info({ txnRef }, 'Getting transaction status via Finacle');

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        txnRef,
        status: 'ERROR',
        errorMessage: (body as { error?: string }).error || `HTTP ${response.status}`,
      };
    }

    return body as unknown as FinacleTransactionStatusResponse;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, txnRef }, 'Finacle getTransactionStatus failed');
    return {
      success: false,
      txnRef,
      status: 'ERROR',
      errorMessage: message,
    };
  }
}
