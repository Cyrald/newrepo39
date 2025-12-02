import bcrypt from "bcryptjs";
import { type Request, type Response, type NextFunction } from "express";
import { logger } from "./utils/logger";
import { verifyAccessToken } from "./utils/jwt";
import { tokenBlacklist } from "./utils/blacklist";
import { getUserStatus, invalidateUserCache as invalidateCacheUtil } from "./utils/userCache";

const DUMMY_PASSWORD_HASH = "$2a$10$DummyHashForTimingAttackProtectionXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function safePasswordCompare(password: string, hash: string | null): Promise<boolean> {
  const actualHash = hash || DUMMY_PASSWORD_HASH;
  const result = await bcrypt.compare(password, actualHash);
  return hash !== null && result;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRoles?: string[];
      tfid?: string;
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        message: "Требуется авторизация",
        code: "MISSING_TOKEN"
      });
      return;
    }

    const token = authHeader.substring(7);
    
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      
      if (errorMessage === 'TOKEN_EXPIRED') {
        res.status(401).json({ 
          message: "Токен истёк", 
          code: "TOKEN_EXPIRED" 
        });
        return;
      }
      
      res.status(401).json({ 
        message: "Неверный токен", 
        code: "INVALID_TOKEN" 
      });
      return;
    }

    if (tokenBlacklist.isFamilyBlacklisted(payload.tfid)) {
      logger.warn('Attempt to use blacklisted token family', {
        userId: payload.userId,
        tfid: payload.tfid
      });
      res.status(401).json({ 
        message: "Сессия инвалидирована", 
        code: "SESSION_REVOKED" 
      });
      return;
    }

    const userStatus = await getUserStatus(payload.userId);
    
    if (payload.v < userStatus.tokenVersion) {
      logger.warn('Revoked token attempt', {
        userId: payload.userId,
        tokenVersion: payload.v,
        currentVersion: userStatus.tokenVersion
      });
      res.status(401).json({ 
        message: "Токен отозван", 
        code: "TOKEN_REVOKED" 
      });
      return;
    }
    
    if (userStatus.deletedAt) {
      logger.warn('Deleted user attempt', { userId: payload.userId });
      res.status(401).json({ 
        message: "Пользователь удалён", 
        code: "USER_DELETED" 
      });
      return;
    }
    
    if (userStatus.banned) {
      logger.warn('Banned user attempt', { userId: payload.userId });
      res.status(403).json({ 
        message: "Пользователь заблокирован", 
        code: "USER_BANNED" 
      });
      return;
    }

    req.userId = payload.userId;
    req.userRoles = payload.roles;
    req.tfid = payload.tfid;
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    res.status(500).json({ 
      message: "Ошибка аутентификации",
      code: "AUTH_ERROR"
    });
  }
}

export function invalidateUserCache(userId: string) {
  invalidateCacheUtil(userId);
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId || !req.userRoles) {
      res.status(401).json({ 
        message: "Требуется авторизация",
        code: "UNAUTHORIZED"
      });
      return;
    }

    const hasRole = roles.some(role => req.userRoles?.includes(role));
    
    if (!hasRole) {
      logger.warn('Insufficient permissions', { 
        userId: req.userId, 
        requiredRoles: roles, 
        userRoles: req.userRoles 
      });
      res.status(403).json({ 
        message: "Недостаточно прав доступа",
        code: "FORBIDDEN"
      });
      return;
    }
    
    next();
  };
}
