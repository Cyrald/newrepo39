import { logger } from './logger';

interface BlacklistEntry {
  expiresAt: number;
  userId: string;
  tfid: string;
  reason: string;
}

interface FamilyBlacklistEntry {
  expiresAt: number;
  userId: string;
}

class TokenBlacklist {
  private jtiBlacklist: Map<string, BlacklistEntry> = new Map();
  private familyBlacklist: Map<string, FamilyBlacklistEntry> = new Map();
  private readonly maxEntries = 100000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupSchedule();
  }

  addJti(jti: string, userId: string, tfid: string, expiresAt: Date, reason: string): void {
    if (this.jtiBlacklist.size >= this.maxEntries) {
      logger.warn('JTI blacklist near capacity, cleaning old entries', {
        size: this.jtiBlacklist.size,
        maxEntries: this.maxEntries
      });
      this.cleanExpired();
    }

    this.jtiBlacklist.set(jti, {
      expiresAt: expiresAt.getTime(),
      userId,
      tfid,
      reason
    });

    logger.info('JTI added to blacklist', {
      jti,
      userId,
      tfid,
      reason,
      expiresAt
    });
  }

  addTokenFamily(tfid: string, userId: string, expiresAt: Date): void {
    if (this.familyBlacklist.size >= this.maxEntries) {
      logger.warn('Token family blacklist near capacity, cleaning old entries', {
        size: this.familyBlacklist.size,
        maxEntries: this.maxEntries
      });
      this.cleanExpired();
    }

    this.familyBlacklist.set(tfid, {
      expiresAt: expiresAt.getTime(),
      userId
    });

    logger.info('Token family added to blacklist', {
      tfid,
      userId,
      expiresAt
    });
  }

  isJtiBlacklisted(jti: string): boolean {
    const entry = this.jtiBlacklist.get(jti);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.jtiBlacklist.delete(jti);
      return false;
    }

    return true;
  }

  isFamilyBlacklisted(tfid: string): boolean {
    const entry = this.familyBlacklist.get(tfid);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.familyBlacklist.delete(tfid);
      return false;
    }

    return true;
  }

  cleanExpired(): void {
    const now = Date.now();
    let jtiCleaned = 0;
    let familyCleaned = 0;

    for (const [jti, entry] of Array.from(this.jtiBlacklist.entries())) {
      if (now > entry.expiresAt) {
        this.jtiBlacklist.delete(jti);
        jtiCleaned++;
      }
    }

    for (const [tfid, entry] of Array.from(this.familyBlacklist.entries())) {
      if (now > entry.expiresAt) {
        this.familyBlacklist.delete(tfid);
        familyCleaned++;
      }
    }

    if (jtiCleaned > 0 || familyCleaned > 0) {
      logger.info('Blacklist cleanup completed', {
        jtiCleaned,
        familyCleaned,
        jtiRemaining: this.jtiBlacklist.size,
        familyRemaining: this.familyBlacklist.size
      });
    }
  }

  startCleanupSchedule(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanExpired();
    }, 5 * 60 * 1000);
  }

  stopCleanupSchedule(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getStats() {
    return {
      jtiCount: this.jtiBlacklist.size,
      familyCount: this.familyBlacklist.size,
      maxEntries: this.maxEntries
    };
  }

  clear(): void {
    this.jtiBlacklist.clear();
    this.familyBlacklist.clear();
    logger.info('Blacklist cleared');
  }
}

export const tokenBlacklist = new TokenBlacklist();
