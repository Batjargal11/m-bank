import nodemailer from 'nodemailer';
import { createLogger } from '@m-bank/shared-utils';
import { config } from '../config';

const logger = createLogger('email-service');

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: false,
});

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: '"M-Bank Notifications" <noreply@m-bank.mn>',
      to,
      subject,
      html,
    });

    logger.info({ to, subject }, 'Email sent successfully');
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send email');
    return false;
  }
}
