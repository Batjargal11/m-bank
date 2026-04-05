import { Request, Response, NextFunction } from 'express';
import { successResponse, PaginationQuery } from '@m-bank/shared-types';
import { ValidationError } from '@m-bank/shared-utils';
import * as orgService from '../services/org.service';

export async function getOrganizations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const paginationQuery: PaginationQuery = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };

    const { organizations, meta } = await orgService.getOrganizations(paginationQuery);
    res.json(successResponse(organizations, meta));
  } catch (err) {
    next(err);
  }
}

export async function getOrganizationById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const org = await orgService.getOrganizationById(req.params.id);
    res.json(successResponse(org));
  } catch (err) {
    next(err);
  }
}

export async function createOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, registration_no } = req.body;
    if (!name || !registration_no) {
      throw new ValidationError('Name and registration number are required');
    }

    const org = await orgService.createOrganization({ name, registration_no });
    res.status(201).json(successResponse(org));
  } catch (err) {
    next(err);
  }
}

export async function updateOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const org = await orgService.updateOrganization(req.params.id, req.body);
    res.json(successResponse(org));
  } catch (err) {
    next(err);
  }
}

export async function getAccounts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const accounts = await orgService.getAccounts(req.params.id);
    res.json(successResponse(accounts));
  } catch (err) {
    next(err);
  }
}

export async function addAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { account_no, currency } = req.body;
    if (!account_no) {
      throw new ValidationError('Account number is required');
    }

    const account = await orgService.addAccount(req.params.id, {
      account_no,
      currency: currency || 'MNT',
    });
    res.status(201).json(successResponse(account));
  } catch (err) {
    next(err);
  }
}
