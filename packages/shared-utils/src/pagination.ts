import { PaginationMeta, PaginationQuery } from '@m-bank/shared-types';

export interface PaginationParams {
  offset: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function parsePagination(query: PaginationQuery, defaultSort = 'created_at'): PaginationParams {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  return {
    offset: (page - 1) * limit,
    limit,
    sortBy: query.sortBy || defaultSort,
    sortOrder: query.sortOrder || 'desc',
  };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
