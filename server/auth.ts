import bcrypt from "bcryptjs";
import { type Request, type Response, type NextFunction } from "express";
import { verifyAccessToken } from "./utils/jwt";
import { getUserStatus, invalidateUserCache } from "./utils/userCache";
import { logger } from "./utils/logger";

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
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      res.status(401).json({ message: "Требуется аутентификация" });
      return;
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      res.status(401).json({ message: "Невалидный токен" });
      return;
    }

    const userStatus = await getUserStatus(payload.userId);

    if (payload.v < userStatus.tokenVersion) {
      logger.warn('Revoked token attempt', {
        userId: payload.userId,
        tokenVersion: payload.v,
        currentVersion: userStatus.tokenVersion
      });
      res.status(401).json({ message: "Токен отозван" });
      return;
    }

    if (userStatus.deletedAt) {
      res.status(401).json({ message: "Аккаунт удален" });
      return;
    }
    
    if (userStatus.banned) {
      res.status(401).json({ message: "Аккаунт заблокирован" });
      return;
    }

    req.userId = payload.userId;
    req.userRoles = payload.roles;

    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(401).json({ message: "Ошибка аутентификации" });
  }
}

export { invalidateUserCache };

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      res.status(401).json({ message: "Требуется аутентификация" });
      return;
    }

    if (!req.userRoles) {
      res.status(403).json({ message: "Роли пользователя не загружены" });
      return;
    }

    const hasRole = req.userRoles.some(role => roles.includes(role));
    if (!hasRole) {
      res.status(403).json({ message: "Недостаточно прав" });
      return;
    }

    next();
  };
}
