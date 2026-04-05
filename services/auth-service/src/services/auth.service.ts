import bcrypt from 'bcryptjs';
import { AuthTokens, JwtPayload, UserRole } from '@m-bank/shared-types';
import { UnauthorizedError } from '@m-bank/shared-utils';
import * as userRepo from '../repositories/user.repository';
import * as tokenService from './token.service';

export async function login(
  username: string,
  password: string,
): Promise<{ tokens: AuthTokens; user: JwtPayload }> {
  const user = await userRepo.findByUsername(username);
  if (!user) {
    throw new UnauthorizedError('Invalid username or password');
  }

  if (!user.is_active) {
    throw new UnauthorizedError('Account is disabled');
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid username or password');
  }

  const payload: JwtPayload = {
    userId: user.user_id,
    orgId: user.org_id,
    role: user.role as UserRole,
    username: user.username,
  };

  const accessToken = tokenService.generateAccessToken(payload);
  const refreshToken = tokenService.generateRefreshToken();

  await tokenService.saveRefreshToken(user.user_id, refreshToken);
  await userRepo.updateLastLogin(user.user_id);

  return {
    tokens: { accessToken, refreshToken },
    user: payload,
  };
}

export async function refresh(
  userId: string,
  rawRefreshToken: string,
): Promise<AuthTokens> {
  const result = await tokenService.verifyRefreshToken(userId, rawRefreshToken);
  if (!result) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  await tokenService.revokeRefreshToken(result.tokenId);

  const user = await userRepo.findById(userId);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('User not found or disabled');
  }

  const payload: JwtPayload = {
    userId: user.user_id,
    orgId: user.org_id,
    role: user.role as UserRole,
    username: user.username,
  };

  const accessToken = tokenService.generateAccessToken(payload);
  const newRefreshToken = tokenService.generateRefreshToken();

  await tokenService.saveRefreshToken(user.user_id, newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string): Promise<void> {
  await tokenService.revokeAllUserTokens(userId);
}
