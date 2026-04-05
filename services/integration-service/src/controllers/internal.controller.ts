import { Request, Response } from 'express';
import { successResponse, errorResponse } from '@m-bank/shared-types';
import { createLogger } from '@m-bank/shared-utils';
import * as finacleAdapter from '../adapters/finacle.adapter';

const logger = createLogger('internal-controller');

export async function validateAccount(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, string>;
    const accountNo = body.accountNo || body.account_no;

    if (!accountNo) {
      res.status(400).json(errorResponse('accountNo is required'));
      return;
    }

    const result = await finacleAdapter.validateAccount(accountNo);

    if (!result.success) {
      res.status(422).json(errorResponse(result.errorMessage || 'Account validation failed'));
      return;
    }

    res.json(successResponse({
      valid: true,
      account_no: result.accountNo || accountNo,
      org_name: result.accountName || result.orgName || '',
      currency: result.currency || 'MNT',
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error }, 'validateAccount failed');
    res.status(500).json(errorResponse(message));
  }
}

export async function checkBalance(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, string>;
    const accountNo = body.accountNo || body.account_no;

    if (!accountNo) {
      res.status(400).json(errorResponse('accountNo is required'));
      return;
    }

    const result = await finacleAdapter.checkBalance(accountNo);

    if (!result.success) {
      res.status(422).json(errorResponse(result.errorMessage || 'Balance check failed'));
      return;
    }

    res.json(successResponse({
      accountNo: result.accountNo,
      availableBalance: result.availableBalance,
      currency: result.currency,
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error }, 'checkBalance failed');
    res.status(500).json(errorResponse(message));
  }
}
