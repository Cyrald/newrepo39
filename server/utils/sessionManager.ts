import { db } from '../db';
import { sessions } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

export async function invalidateAllUserSessions(userId: string): Promise<number> {
  try {
    const result = await db.execute(
      sql`DELETE FROM session WHERE (sess->>'userId')::text = ${userId}`
    );
    
    const deletedCount = result.rowCount || 0;
    
    logger.info('Invalidated all user sessions', { 
      userId, 
      sessionsDeleted: deletedCount 
    });
    
    return deletedCount;
  } catch (error: any) {
    logger.error('Failed to invalidate user sessions', { 
      userId, 
      error: error.message 
    });
    throw new Error('Не удалось инвалидировать сессии');
  }
}

export async function getCurrentSessionId(sessionObj: any): Promise<string | null> {
  return sessionObj?.id || null;
}
