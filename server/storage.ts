// Добавить функцию для batch получения ролей
export async function getUsersWithRolesBatch(userIds?: string[]): Promise<Map<string, string[]>> {
  const rolesQuery = await db.select().from(userRoles);
  
  const rolesMap = new Map<string, string[]>();
  
  for (const roleRecord of rolesQuery) {
    if (!rolesMap.has(roleRecord.userId)) {
      rolesMap.set(roleRecord.userId, []);
    }
    rolesMap.get(roleRecord.userId)!.push(roleRecord.role);
  }
  
  return rolesMap;
}
