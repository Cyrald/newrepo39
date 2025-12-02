import { db } from "../db";
import { users, userRoles, sessions, refreshTokens } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { hashPassword, comparePassword } from "../auth";
import { generateAccessToken, generateRefreshToken, generateTokenFamily, verifyRefreshToken } from "../utils/jwt";
import { tokenBlacklist } from "../utils/blacklist";
import { invalidateUserCache } from "../auth";
import { logger } from "../utils/logger";
import type { Request } from "express";

const MAX_ROTATION_COUNT = 10;

interface LoginResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    patronymic: string | null;
    phone: string;
    isVerified: boolean;
    bonusBalance: number;
    roles: string[];
  };
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string | null;
  patronymic?: string | null;
  phone: string;
}) {
  const existingUser = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  
  if (existingUser.length > 0) {
    throw new Error('EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await hashPassword(data.password);

  const [user] = await db.insert(users).values({
    email: data.email,
    passwordHash,
    firstName: data.firstName,
    lastName: data.lastName || null,
    patronymic: data.patronymic || null,
    phone: data.phone,
    isVerified: false,
    bonusBalance: 100,
    tokenVersion: 1,
  }).returning();

  await db.insert(userRoles).values({
    userId: user.id,
    role: 'customer',
  });

  logger.info('User registered', { userId: user.id, email: user.email });

  return user;
}

export async function loginUser(email: string, password: string, req: Request): Promise<LoginResult> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const passwordValid = await comparePassword(password, user.passwordHash);
  
  if (!passwordValid) {
    logger.warn('Failed login attempt', { email });
    throw new Error('INVALID_CREDENTIALS');
  }

  if (user.banned) {
    throw new Error('USER_BANNED');
  }

  if (user.deletedAt) {
    throw new Error('USER_DELETED');
  }

  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  const roleNames = roles.map(r => r.role);

  const tfid = generateTokenFamily();
  const accessToken = generateAccessToken(user.id, roleNames, tfid, user.tokenVersion);
  const { token: refreshToken, jti } = generateRefreshToken(user.id, tfid);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const [session] = await db.insert(sessions).values({
    userId: user.id,
    tfid,
    userAgent: req.headers['user-agent'] || null,
    ipAddress: req.ip || null,
    expiresAt,
  }).returning();

  await db.insert(refreshTokens).values({
    jti,
    sessionId: session.id,
    userId: user.id,
    tfid,
    rotationCount: 0,
    expiresAt,
  });

  logger.info('User logged in', { userId: user.id, tfid, sessionId: session.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      patronymic: user.patronymic,
      phone: user.phone,
      isVerified: user.isVerified,
      bonusBalance: user.bonusBalance,
      roles: roleNames,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(refreshTokenString: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenString);
  } catch (error) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  if (tokenBlacklist.isJtiBlacklisted(payload.jti)) {
    logger.warn('Attempt to use blacklisted refresh token', { jti: payload.jti, userId: payload.userId });
    throw new Error('TOKEN_REVOKED');
  }

  if (tokenBlacklist.isFamilyBlacklisted(payload.tfid)) {
    logger.warn('Attempt to use blacklisted token family', { tfid: payload.tfid, userId: payload.userId });
    throw new Error('SESSION_REVOKED');
  }

  const [storedToken] = await db.select().from(refreshTokens)
    .where(and(
      eq(refreshTokens.jti, payload.jti),
      eq(refreshTokens.userId, payload.userId)
    ))
    .limit(1);

  if (!storedToken) {
    logger.warn('Refresh token not found in database', { jti: payload.jti, userId: payload.userId });
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  if (storedToken.revokedAt) {
    logger.warn('Attempt to use revoked refresh token', { jti: payload.jti, userId: payload.userId });
    
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tfid, payload.tfid));
    
    const tokenExpiresAt = new Date(storedToken.expiresAt);
    tokenBlacklist.addTokenFamily(payload.tfid, payload.userId, tokenExpiresAt);
    
    throw new Error('TOKEN_REUSE_DETECTED');
  }

  if (storedToken.rotationCount >= MAX_ROTATION_COUNT) {
    logger.warn('Max rotation count reached', { tfid: payload.tfid, userId: payload.userId });
    
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tfid, payload.tfid));
    
    const tokenExpiresAt = new Date(storedToken.expiresAt);
    tokenBlacklist.addTokenFamily(payload.tfid, payload.userId, tokenExpiresAt);
    
    throw new Error('MAX_ROTATION_EXCEEDED');
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.banned) {
    throw new Error('USER_BANNED');
  }

  if (user.deletedAt) {
    throw new Error('USER_DELETED');
  }

  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  const roleNames = roles.map(r => r.role);

  await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.jti, payload.jti));

  const oldTokenExpiresAt = new Date(storedToken.expiresAt);
  tokenBlacklist.addJti(payload.jti, payload.userId, payload.tfid, oldTokenExpiresAt, 'rotation');

  const newAccessToken = generateAccessToken(user.id, roleNames, payload.tfid, user.tokenVersion);
  const { token: newRefreshToken, jti: newJti } = generateRefreshToken(user.id, payload.tfid);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await db.insert(refreshTokens).values({
    jti: newJti,
    sessionId: storedToken.sessionId,
    userId: user.id,
    tfid: payload.tfid,
    rotationCount: storedToken.rotationCount + 1,
    expiresAt,
  });

  await db.update(sessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(sessions.id, storedToken.sessionId));

  logger.info('Tokens refreshed', { userId: user.id, tfid: payload.tfid, rotationCount: storedToken.rotationCount + 1 });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logoutUser(tfid: string, userId: string): Promise<void> {
  const [session] = await db.select().from(sessions)
    .where(and(
      eq(sessions.tfid, tfid),
      eq(sessions.userId, userId)
    ))
    .limit(1);

  if (!session) {
    return;
  }

  await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tfid, tfid));

  const latestToken = await db.select().from(refreshTokens)
    .where(eq(refreshTokens.tfid, tfid))
    .orderBy(desc(refreshTokens.createdAt))
    .limit(1);

  if (latestToken.length > 0) {
    const tokenExpiresAt = new Date(latestToken[0].expiresAt);
    tokenBlacklist.addTokenFamily(tfid, userId, tokenExpiresAt);
  }

  logger.info('User logged out', { userId, tfid, sessionId: session.id });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const passwordValid = await comparePassword(currentPassword, user.passwordHash);
  
  if (!passwordValid) {
    throw new Error('INVALID_PASSWORD');
  }

  const newPasswordHash = await hashPassword(newPassword);
  const newTokenVersion = user.tokenVersion + 1;

  await db.update(users)
    .set({ 
      passwordHash: newPasswordHash,
      tokenVersion: newTokenVersion,
    })
    .where(eq(users.id, userId));

  const userSessions = await db.select().from(sessions)
    .where(and(
      eq(sessions.userId, userId),
      gte(sessions.expiresAt, new Date())
    ));

  for (const session of userSessions) {
    const tokens = await db.select().from(refreshTokens)
      .where(eq(refreshTokens.sessionId, session.id));
    
    for (const token of tokens) {
      const tokenExpiresAt = new Date(token.expiresAt);
      tokenBlacklist.addTokenFamily(token.tfid, userId, tokenExpiresAt);
    }
  }

  await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.userId, userId));

  invalidateUserCache(userId);

  logger.info('Password changed and all sessions invalidated', { userId });
}

export async function getUserSessions(userId: string) {
  const userSessions = await db.select({
    id: sessions.id,
    tfid: sessions.tfid,
    userAgent: sessions.userAgent,
    ipAddress: sessions.ipAddress,
    lastActivityAt: sessions.lastActivityAt,
    expiresAt: sessions.expiresAt,
    createdAt: sessions.createdAt,
  })
  .from(sessions)
  .where(and(
    eq(sessions.userId, userId),
    gte(sessions.expiresAt, new Date())
  ))
  .orderBy(desc(sessions.lastActivityAt));

  return userSessions;
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  const [session] = await db.select()
    .from(sessions)
    .where(and(
      eq(sessions.id, sessionId),
      eq(sessions.userId, userId)
    ))
    .limit(1);

  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.sessionId, sessionId));

  const tokens = await db.select().from(refreshTokens)
    .where(eq(refreshTokens.sessionId, sessionId))
    .limit(1);

  if (tokens.length > 0) {
    const tokenExpiresAt = new Date(tokens[0].expiresAt);
    tokenBlacklist.addTokenFamily(session.tfid, userId, tokenExpiresAt);
  }

  logger.info('Session deleted', { userId, sessionId, tfid: session.tfid });
}
