function baseTemplate(title: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 30px; }
          h1 { color: #1a237e; font-size: 20px; }
          .amount { font-size: 24px; font-weight: bold; color: #2e7d32; }
          .footer { margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          ${body}
          <div class="footer">
            <p>This is an automated notification from M-Bank. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function invoiceReceived(invoiceNo: string, senderName: string, amount: number): string {
  return baseTemplate(
    'New Invoice Received',
    `
      <p>You have received a new invoice from <strong>${senderName}</strong>.</p>
      <p>Invoice Number: <strong>${invoiceNo}</strong></p>
      <p>Amount: <span class="amount">${amount.toLocaleString()} MNT</span></p>
      <p>Please log in to M-Bank to review and process this invoice.</p>
    `,
  );
}

export function paymentCompleted(invoiceNo: string, amount: number): string {
  return baseTemplate(
    'Payment Received',
    `
      <p>A payment has been successfully processed for your invoice.</p>
      <p>Invoice Number: <strong>${invoiceNo}</strong></p>
      <p>Amount Received: <span class="amount">${amount.toLocaleString()} MNT</span></p>
      <p>The payment has been credited to your account.</p>
    `,
  );
}

export function invoiceCancelled(invoiceNo: string): string {
  return baseTemplate(
    'Invoice Cancelled',
    `
      <p>An invoice has been cancelled.</p>
      <p>Invoice Number: <strong>${invoiceNo}</strong></p>
      <p>Please log in to M-Bank for more details.</p>
    `,
  );
}
