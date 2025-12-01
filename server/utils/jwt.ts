import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { env } from '../env';

export interface AccessTokenPayload {
  userId: string;
  roles: string[];
  v: number;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  jti: string;
  iat: number;
  exp: number;
}

export function generateAccessToken(
  userId: string, 
  roles: string[], 
  tokenVersion: number
): string {
  return jwt.sign(
    { userId, roles, v: tokenVersion },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export function generateRefreshToken(userId: string): { token: string; jti: string } {
  const jti = nanoid();
  const token = jwt.sign(
    { userId, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
