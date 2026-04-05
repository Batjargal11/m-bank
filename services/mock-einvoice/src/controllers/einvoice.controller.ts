import { Request, Response } from 'express';
import * as einvoiceService from '../services/einvoice.service';

export async function registerInvoice(req: Request, res: Response): Promise<void> {
  const b = req.body;
  const invoice_no = b.invoice_no || b.invoiceNo;
  const sender_name = b.sender_name || b.sender || 'Unknown';
  const sender_tin = b.sender_tin || '0000000';
  const receiver_name = b.receiver_name || b.receiver || 'Unknown';
  const receiver_tin = b.receiver_tin || '0000000';
  const amount = b.amount || 0;

  if (!invoice_no) {
    res.status(400).json({ success: false, error: 'invoice_no is required' });
    return;
  }

  const result = einvoiceService.registerInvoice({
    invoice_no,
    sender_name,
    sender_tin,
    receiver_name,
    receiver_tin,
    amount,
    currency: b.currency || 'MNT',
    description: b.description || '',
  });

  res.status(201).json({
    success: true,
    data: result,
  });
}

export async function getInvoice(req: Request, res: Response): Promise<void> {
  const { ref } = req.params;

  const record = einvoiceService.getInvoice(ref);

  if (!record) {
    res.status(404).json({
      success: false,
      error: `E-invoice ${ref} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: record,
  });
}

export async function cancelInvoice(req: Request, res: Response): Promise<void> {
  const { ref } = req.params;

  const record = einvoiceService.cancelInvoice(ref);

  if (!record) {
    res.status(404).json({
      success: false,
      error: `E-invoice ${ref} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: record,
  });
}

export async function getInvoiceStatus(req: Request, res: Response): Promise<void> {
  const { ref } = req.params;

  const result = einvoiceService.getInvoiceStatus(ref);

  if (!result) {
    res.status(404).json({
      success: false,
      error: `E-invoice ${ref} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
}
