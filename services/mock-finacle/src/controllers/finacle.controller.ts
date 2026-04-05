import { Request, Response } from 'express';
import * as finacleService from '../services/finacle.service';

export async function validateAccount(req: Request, res: Response): Promise<void> {
  const { account_no } = req.body;

  if (!account_no) {
    res.status(400).json({
      success: false,
      error: 'account_no is required',
    });
    return;
  }

  const result = finacleService.validateAccount(account_no);

  if (!result) {
    res.status(404).json({
      success: false,
      error: `Account ${account_no} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
}

export async function getBalance(req: Request, res: Response): Promise<void> {
  const { account_no } = req.body;

  if (!account_no) {
    res.status(400).json({
      success: false,
      error: 'account_no is required',
    });
    return;
  }

  const result = finacleService.getBalance(account_no);

  if (!result) {
    res.status(404).json({
      success: false,
      error: `Account ${account_no} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
}

export async function performTransfer(req: Request, res: Response): Promise<void> {
  const { debit_account, credit_account, amount, reference } = req.body;

  if (!debit_account || !credit_account || !amount || !reference) {
    res.status(400).json({
      success: false,
      error: 'debit_account, credit_account, amount, and reference are required',
    });
    return;
  }

  if (typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({
      success: false,
      error: 'amount must be a positive number',
    });
    return;
  }

  const result = await finacleService.transfer(debit_account, credit_account, amount, reference);

  if (!result.success) {
    res.status(422).json({
      success: false,
      error: result.error_message,
      data: result,
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
}

export async function getTransaction(req: Request, res: Response): Promise<void> {
  const { ref } = req.params;

  const transaction = finacleService.getTransaction(ref);

  if (!transaction) {
    res.status(404).json({
      success: false,
      error: `Transaction ${ref} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: transaction,
  });
}
