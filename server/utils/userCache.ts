import { storage } from '../storage';

interface CachedUserStatus {
  banned: boolean;
  deletedAt: Date | null;
  tokenVersion: number;
  cachedAt: number;
}

const userCache = new Map<string, CachedUserStatus>();
const CACHE_TTL = 10 * 60 * 1000;

export async function getUserStatus(userId: string): Promise<CachedUserStatus> {
  const cached = userCache.get(userId);
  const now = Date.now();
  
  if (cached && now - cached.cachedAt < CACHE_TTL) {
    return cached;
  }
  
  const user = await storage.getUser(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const status: CachedUserStatus = {
    banned: user.banned || false,
    deletedAt: user.deletedAt || null,
    tokenVersion: user.tokenVersion || 1,
    cachedAt: now
  };
  
  userCache.set(userId, status);
  return status;
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

export function clearUserCache(): void {
  userCache.clear();
}
