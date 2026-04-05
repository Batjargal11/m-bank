export interface Account {
  readonly account_no: string;
  readonly org_name: string;
  readonly currency: string;
  balance: number;
  readonly is_active: boolean;
}

export interface Transaction {
  readonly txn_ref: string;
  readonly debit_account: string;
  readonly credit_account: string;
  readonly amount: number;
  readonly currency: string;
  readonly reference: string;
  readonly status: 'SUCCESS' | 'FAILED';
  readonly created_at: string;
}

// Pre-seeded mock accounts for 2 organizations
export const accounts: Account[] = [
  // Org A: Монгол Технологи ХХК
  {
    account_no: '1001000001',
    org_name: 'Монгол Технологи ХХК',
    currency: 'MNT',
    balance: 50_000_000,
    is_active: true,
  },
  {
    account_no: '1001000002',
    org_name: 'Монгол Технологи ХХК',
    currency: 'USD',
    balance: 100_000,
    is_active: true,
  },
  // Org B: Улаанбаатар Худалдаа ХХК
  {
    account_no: '2001000001',
    org_name: 'Улаанбаатар Худалдаа ХХК',
    currency: 'MNT',
    balance: 30_000_000,
    is_active: true,
  },
  {
    account_no: '2001000002',
    org_name: 'Улаанбаатар Худалдаа ХХК',
    currency: 'USD',
    balance: 50_000,
    is_active: true,
  },
];

// In-memory transaction store
export const transactions: Transaction[] = [];
