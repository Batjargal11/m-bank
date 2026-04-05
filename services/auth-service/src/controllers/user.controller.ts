import { Request, Response, NextFunction } from 'express';
import { successResponse, PaginationQuery } from '@m-bank/shared-types';
import { ValidationError } from '@m-bank/shared-utils';
import * as userService from '../services/user.service';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';

export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const isAdmin = req.user?.role === 'SYSTEM_ADMIN' || req.user?.role === 'BANK_OPERATOR';
    const orgId = req.query.orgId as string || (isAdmin ? undefined : req.user?.orgId);

    const paginationQuery: PaginationQuery = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };

    const { users, meta } = orgId
      ? await userService.getUsers(orgId, paginationQuery)
      : await userService.getAllUsers(paginationQuery);
    res.json(successResponse(users, meta));
  } catch (err) {
    next(err);
  }
}

export async function getUserById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
}

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const orgId = req.body.org_id || req.user?.orgId;
    if (!orgId) {
      throw new ValidationError('Organization ID is required');
    }

    const user = await userService.createUser(orgId, parsed.data);
    res.status(201).json(successResponse(user));
  } catch (err) {
    next(err);
  }
}

export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const user = await userService.updateUser(req.params.id, parsed.data);
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
}

export async function toggleUserStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = await userService.getUserById(req.params.id);
    const user = await userService.updateUser(req.params.id, {
      is_active: !currentUser.is_active,
    });
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
}
