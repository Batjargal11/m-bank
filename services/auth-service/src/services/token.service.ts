import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from '@m-bank/shared-types';
import { config } from '../config';
import { query } from '../db/connection';

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  } as jwt.SignOptions);
}

export function generateRefreshToken(): string {
  return uuidv4();
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export async function saveRefreshToken(
  userId: string,
  rawToken: string,
  expiresInDays: number = 7,
): Promise<void> {
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()],
  );
}

export async function verifyRefreshToken(
  userId: string,
  rawToken: string,
): Promise<{ tokenId: string } | null> {
  const { rows } = await query<{
    token_id: string;
    token_hash: string;
    expires_at: string;
  }>(
    `SELECT token_id, token_hash, expires_at
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked = false AND expires_at > NOW()`,
    [userId],
  );

  for (const row of rows) {
    const isMatch = await bcrypt.compare(rawToken, row.token_hash);
    if (isMatch) {
      return { tokenId: row.token_id };
    }
  }

  return null;
}

export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revoked = true WHERE token_id = $1',
    [tokenId],
  );
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false',
    [userId],
  );
}
