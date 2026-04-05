import { query } from '../db/connection';
import { User, CreateUserDto } from '@m-bank/shared-types';
import { PaginationParams } from '@m-bank/shared-utils';

interface UserRow {
  user_id: string;
  org_id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export async function findByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    'SELECT * FROM users WHERE username = $1',
    [username],
  );
  return rows[0] || null;
}

export async function findById(userId: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    'SELECT * FROM users WHERE user_id = $1',
    [userId],
  );
  return rows[0] || null;
}

export async function findAll(
  pagination: PaginationParams,
): Promise<{ users: User[]; total: number }> {
  const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM users', []);
  const total = parseInt(countResult.rows[0].count, 10);

  const { rows } = await query<UserRow>(
    `SELECT user_id, org_id, username, email, full_name, role, is_active, last_login, created_at, updated_at
     FROM users ORDER BY ${pagination.sortBy} ${pagination.sortOrder} LIMIT $1 OFFSET $2`,
    [pagination.limit, pagination.offset],
  );

  return { users: rows.map(toUser), total };
}

export async function findByOrgId(
  orgId: string,
  pagination: PaginationParams,
): Promise<{ users: User[]; total: number }> {
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM users WHERE org_id = $1',
    [orgId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const { rows } = await query<UserRow>(
    `SELECT user_id, org_id, username, email, full_name, role, is_active, last_login, created_at, updated_at
     FROM users
     WHERE org_id = $1
     ORDER BY ${pagination.sortBy} ${pagination.sortOrder}
     LIMIT $2 OFFSET $3`,
    [orgId, pagination.limit, pagination.offset],
  );

  const users: User[] = rows.map(toUser);
  return { users, total };
}

export async function create(
  orgId: string,
  dto: CreateUserDto,
  passwordHash: string,
): Promise<User> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (org_id, username, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING user_id, org_id, username, email, full_name, role, is_active, last_login, created_at, updated_at`,
    [orgId, dto.username, dto.email, passwordHash, dto.full_name, dto.role],
  );
  return toUser(rows[0]);
}

export async function update(
  userId: string,
  fields: Partial<Pick<User, 'email' | 'full_name' | 'role' | 'is_active'>>,
): Promise<User | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (fields.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(fields.email);
  }
  if (fields.full_name !== undefined) {
    setClauses.push(`full_name = $${paramIndex++}`);
    values.push(fields.full_name);
  }
  if (fields.role !== undefined) {
    setClauses.push(`role = $${paramIndex++}`);
    values.push(fields.role);
  }
  if (fields.is_active !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(fields.is_active);
  }

  if (setClauses.length === 0) {
    return findById(userId).then((row) => (row ? toUser(row) : null));
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(userId);

  const { rows } = await query<UserRow>(
    `UPDATE users SET ${setClauses.join(', ')} WHERE user_id = $${paramIndex}
     RETURNING user_id, org_id, username, email, full_name, role, is_active, last_login, created_at, updated_at`,
    values,
  );

  return rows[0] ? toUser(rows[0]) : null;
}

export async function updateLastLogin(userId: string): Promise<void> {
  await query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [userId]);
}

function toUser(row: UserRow): User {
  return {
    user_id: row.user_id,
    org_id: row.org_id,
    username: row.username,
    email: row.email,
    full_name: row.full_name,
    role: row.role as User['role'],
    is_active: row.is_active,
    last_login: row.last_login,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
