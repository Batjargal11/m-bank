import bcrypt from 'bcryptjs';
import { User, CreateUserDto, PaginationQuery } from '@m-bank/shared-types';
import {
  NotFoundError,
  ConflictError,
  parsePagination,
  buildPaginationMeta,
  PaginationParams,
} from '@m-bank/shared-utils';
import * as userRepo from '../repositories/user.repository';

const SALT_ROUNDS = 10;

export async function getUsers(
  orgId: string,
  paginationQuery: PaginationQuery,
): Promise<{ users: User[]; meta: ReturnType<typeof buildPaginationMeta> }> {
  const pagination: PaginationParams = parsePagination(paginationQuery);
  const { users, total } = await userRepo.findByOrgId(orgId, pagination);
  const page = Math.max(1, paginationQuery.page || 1);
  const limit = Math.min(100, Math.max(1, paginationQuery.limit || 20));
  const meta = buildPaginationMeta(total, page, limit);

  return { users, meta };
}

export async function getAllUsers(
  paginationQuery: PaginationQuery,
): Promise<{ users: User[]; meta: ReturnType<typeof buildPaginationMeta> }> {
  const pagination: PaginationParams = parsePagination(paginationQuery);
  const { users, total } = await userRepo.findAll(pagination);
  const page = Math.max(1, paginationQuery.page || 1);
  const limit = Math.min(100, Math.max(1, paginationQuery.limit || 100));
  const meta = buildPaginationMeta(total, page, limit);
  return { users, meta };
}

export async function getUserById(userId: string): Promise<User> {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new NotFoundError('User', userId);
  }
  return {
    user_id: user.user_id,
    org_id: user.org_id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role as User['role'],
    is_active: user.is_active,
    last_login: user.last_login,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function createUser(
  orgId: string,
  dto: CreateUserDto,
): Promise<User> {
  const existing = await userRepo.findByUsername(dto.username);
  if (existing) {
    throw new ConflictError(`Username '${dto.username}' is already taken`);
  }

  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
  return userRepo.create(orgId, dto, passwordHash);
}

export async function updateUser(
  userId: string,
  fields: Partial<Pick<User, 'email' | 'full_name' | 'role' | 'is_active'>>,
): Promise<User> {
  const updated = await userRepo.update(userId, fields);
  if (!updated) {
    throw new NotFoundError('User', userId);
  }
  return updated;
}
