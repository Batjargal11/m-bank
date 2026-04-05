import { query } from '../db/connection';
import {
  Organization,
  Account,
  CreateOrganizationDto,
  CreateAccountDto,
} from '@m-bank/shared-types';
import { PaginationParams } from '@m-bank/shared-utils';

export async function findAll(
  pagination: PaginationParams,
): Promise<{ organizations: Organization[]; total: number }> {
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM organizations',
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const { rows } = await query<Organization>(
    `SELECT * FROM organizations
     ORDER BY ${pagination.sortBy} ${pagination.sortOrder}
     LIMIT $1 OFFSET $2`,
    [pagination.limit, pagination.offset],
  );

  return { organizations: rows, total };
}

export async function findById(orgId: string): Promise<Organization | null> {
  const { rows } = await query<Organization>(
    'SELECT * FROM organizations WHERE org_id = $1',
    [orgId],
  );
  return rows[0] || null;
}

export async function findByRegistrationNo(registrationNo: string): Promise<Organization | null> {
  const { rows } = await query<Organization>(
    'SELECT * FROM organizations WHERE registration_no = $1',
    [registrationNo],
  );
  return rows[0] || null;
}

export async function create(dto: CreateOrganizationDto): Promise<Organization> {
  const { rows } = await query<Organization>(
    `INSERT INTO organizations (name, registration_no)
     VALUES ($1, $2)
     RETURNING *`,
    [dto.name, dto.registration_no],
  );
  return rows[0];
}

export async function update(
  orgId: string,
  fields: Partial<Pick<Organization, 'name' | 'is_active'>>,
): Promise<Organization | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (fields.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(fields.name);
  }
  if (fields.is_active !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(fields.is_active);
  }

  if (setClauses.length === 0) {
    return findById(orgId);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(orgId);

  const { rows } = await query<Organization>(
    `UPDATE organizations SET ${setClauses.join(', ')} WHERE org_id = $${paramIndex}
     RETURNING *`,
    values,
  );

  return rows[0] || null;
}

export async function findAccountsByOrgId(orgId: string): Promise<Account[]> {
  const { rows } = await query<Account>(
    'SELECT * FROM accounts WHERE org_id = $1 ORDER BY created_at DESC',
    [orgId],
  );
  return rows;
}

export async function createAccount(
  orgId: string,
  dto: CreateAccountDto,
): Promise<Account> {
  const { rows } = await query<Account>(
    `INSERT INTO accounts (org_id, account_no, currency)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [orgId, dto.account_no, dto.currency],
  );
  return rows[0];
}
