import { storage } from '../storage';
import { updatePrivilegedUserCache, invalidateUserCache } from '../utils/userCache';
import type { InsertUserRole, UserRole } from '@shared/schema';

export async function addUserRoleWithCacheUpdate(role: InsertUserRole): Promise<UserRole> {
  const userRole = await storage.addUserRole(role);
  await storage.incrementTokenVersion(role.userId);
  await updatePrivilegedUserCache(role.userId);
  return userRole;
}

export async function removeUserRoleWithCacheUpdate(userId: string, role: string): Promise<void> {
  await storage.removeUserRole(userId, role);
  await storage.incrementTokenVersion(userId);
  await updatePrivilegedUserCache(userId);
}
