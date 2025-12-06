import { storage } from '../storage';
import { db } from '../db';
import { users, userRoles } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from './logger';

const PRIVILEGED_ROLES = ['admin', 'marketer', 'consultant'];

interface CachedUserStatus {
  banned: boolean;
  deletedAt: Date | null;
  tokenVersion: number;
  roles: string[];
  cachedAt: number;
  isPrivileged: boolean;
}

const userCache = new Map<string, CachedUserStatus>();
const privilegedUsersCache = new Map<string, CachedUserStatus>();
const CACHE_TTL = 10 * 60 * 1000;

export async function loadPrivilegedUsersCache(): Promise<void> {
  try {
    const privilegedRoles = await db
      .select({
        userId: userRoles.userId,
        role: userRoles.role,
      })
      .from(userRoles)
      .where(inArray(userRoles.role, PRIVILEGED_ROLES));
    
    const privilegedUserIds = [...new Set(privilegedRoles.map(r => r.userId))];
    
    if (privilegedUserIds.length === 0) {
      logger.info('No privileged users found to cache');
      return;
    }
    
    const privilegedUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, privilegedUserIds));
    
    const rolesMap = new Map<string, string[]>();
    for (const roleRecord of privilegedRoles) {
      if (!rolesMap.has(roleRecord.userId)) {
        rolesMap.set(roleRecord.userId, []);
      }
      rolesMap.get(roleRecord.userId)!.push(roleRecord.role);
    }
    
    const now = Date.now();
    for (const user of privilegedUsers) {
      const userRolesList = rolesMap.get(user.id) || [];
      const status: CachedUserStatus = {
        banned: user.banned || false,
        deletedAt: user.deletedAt || null,
        tokenVersion: user.tokenVersion || 1,
        roles: userRolesList,
        cachedAt: now,
        isPrivileged: true,
      };
      privilegedUsersCache.set(user.id, status);
    }
    
    logger.info(`Loaded ${privilegedUsersCache.size} privileged users into cache`);
  } catch (error) {
    logger.error('Failed to load privileged users cache', { error });
  }
}

export async function getUserStatus(userId: string): Promise<CachedUserStatus> {
  const privilegedCached = privilegedUsersCache.get(userId);
  if (privilegedCached) {
    return privilegedCached;
  }
  
  const cached = userCache.get(userId);
  const now = Date.now();
  
  if (cached && now - cached.cachedAt < CACHE_TTL) {
    return cached;
  }
  
  const user = await storage.getUser(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const roles = await storage.getUserRoles(userId);
  const roleNames = roles.map(r => r.role);
  const isPrivileged = roleNames.some(r => PRIVILEGED_ROLES.includes(r));
  
  const status: CachedUserStatus = {
    banned: user.banned || false,
    deletedAt: user.deletedAt || null,
    tokenVersion: user.tokenVersion || 1,
    roles: roleNames,
    cachedAt: now,
    isPrivileged,
  };
  
  if (isPrivileged) {
    privilegedUsersCache.set(userId, status);
  } else {
    userCache.set(userId, status);
  }
  
  return status;
}

export async function updatePrivilegedUserCache(userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) {
    privilegedUsersCache.delete(userId);
    userCache.delete(userId);
    return;
  }
  
  const roles = await storage.getUserRoles(userId);
  const roleNames = roles.map(r => r.role);
  const isPrivileged = roleNames.some(r => PRIVILEGED_ROLES.includes(r));
  
  const now = Date.now();
  const status: CachedUserStatus = {
    banned: user.banned || false,
    deletedAt: user.deletedAt || null,
    tokenVersion: user.tokenVersion || 1,
    roles: roleNames,
    cachedAt: now,
    isPrivileged,
  };
  
  if (isPrivileged) {
    userCache.delete(userId);
    privilegedUsersCache.set(userId, status);
  } else {
    privilegedUsersCache.delete(userId);
    userCache.set(userId, status);
  }
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
  privilegedUsersCache.delete(userId);
}

export function clearUserCache(): void {
  userCache.clear();
  privilegedUsersCache.clear();
}

export function getCacheStats(): { regularUsers: number; privilegedUsers: number } {
  return {
    regularUsers: userCache.size,
    privilegedUsers: privilegedUsersCache.size,
  };
}
