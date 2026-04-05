import { v4 as uuidv4 } from 'uuid';
import { accounts, transactions, Account, Transaction } from '../data/seed';

export interface ValidateAccountResult {
  valid: boolean;
  account_no: string;
  org_name: string;
  currency: string;
  is_active: boolean;
}

export interface BalanceResult {
  account_no: string;
  currency: string;
  balance: number;
  available_balance: number;
}

export interface TransferResult {
  success: boolean;
  txn_ref: string | null;
  error_message: string | null;
  debit_account: string;
  credit_account: string;
  amount: number;
  currency: string;
}

function findAccount(accountNo: string): Account | undefined {
  return accounts.find((a) => a.account_no === accountNo);
}

export function validateAccount(accountNo: string): ValidateAccountResult | null {
  const account = findAccount(accountNo);

  if (!account) {
    return null;
  }

  return {
    valid: account.is_active,
    account_no: account.account_no,
    org_name: account.org_name,
    currency: account.currency,
    is_active: account.is_active,
  };
}

export function getBalance(accountNo: string): BalanceResult | null {
  const account = findAccount(accountNo);

  if (!account) {
    return null;
  }

  return {
    account_no: account.account_no,
    currency: account.currency,
    balance: account.balance,
    available_balance: account.balance,
  };
}

export function transfer(
  debitAccountNo: string,
  creditAccountNo: string,
  amount: number,
  reference: string,
): Promise<TransferResult> {
  return new Promise((resolve) => {
    // Simulate 500ms processing delay
    setTimeout(() => {
      const debitAccount = findAccount(debitAccountNo);
      const creditAccount = findAccount(creditAccountNo);

      if (!debitAccount) {
        resolve({
          success: false,
          txn_ref: null,
          error_message: `Debit account ${debitAccountNo} not found`,
          debit_account: debitAccountNo,
          credit_account: creditAccountNo,
          amount,
          currency: '',
        });
        return;
      }

      if (!creditAccount) {
        resolve({
          success: false,
          txn_ref: null,
          error_message: `Credit account ${creditAccountNo} not found`,
          debit_account: debitAccountNo,
          credit_account: creditAccountNo,
          amount,
          currency: debitAccount.currency,
        });
        return;
      }

      if (!debitAccount.is_active || !creditAccount.is_active) {
        resolve({
          success: false,
          txn_ref: null,
          error_message: 'One or both accounts are inactive',
          debit_account: debitAccountNo,
          credit_account: creditAccountNo,
          amount,
          currency: debitAccount.currency,
        });
        return;
      }

      if (debitAccount.currency !== creditAccount.currency) {
        resolve({
          success: false,
          txn_ref: null,
          error_message: 'Currency mismatch between accounts',
          debit_account: debitAccountNo,
          credit_account: creditAccountNo,
          amount,
          currency: debitAccount.currency,
        });
        return;
      }

      if (debitAccount.balance < amount) {
        resolve({
          success: false,
          txn_ref: null,
          error_message: 'Insufficient balance',
          debit_account: debitAccountNo,
          credit_account: creditAccountNo,
          amount,
          currency: debitAccount.currency,
        });
        return;
      }

      // 10% random failure for demo purposes
      if (Math.random() < 0.1) {
        resolve({
          success: false,
          txn_ref: null,
          error_message: 'Core banking system temporarily unavailable',
          debit_account: debitAccountNo,
          credit_account: creditAccountNo,
          amount,
          currency: debitAccount.currency,
        });
        return;
      }

      // Perform the transfer (mutating in-memory state for the mock)
      debitAccount.balance -= amount;
      creditAccount.balance += amount;

      const txnRef = `FIN-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const transaction: Transaction = {
        txn_ref: txnRef,
        debit_account: debitAccountNo,
        credit_account: creditAccountNo,
        amount,
        currency: debitAccount.currency,
        reference,
        status: 'SUCCESS',
        created_at: new Date().toISOString(),
      };

      transactions.push(transaction);

      resolve({
        success: true,
        txn_ref: txnRef,
        error_message: null,
        debit_account: debitAccountNo,
        credit_account: creditAccountNo,
        amount,
        currency: debitAccount.currency,
      });
    }, 500);
  });
}

export function getTransaction(txnRef: string): Transaction | null {
  return transactions.find((t) => t.txn_ref === txnRef) || null;
}
