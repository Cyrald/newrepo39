import cors from 'cors';
import { logger } from '../utils/logger';

const isProduction = process.env.NODE_ENV === 'production';

export const corsMiddleware = cors({
  origin: isProduction
    ? (origin, callback) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          process.env.REPLIT_DEV_DOMAIN
        ].filter(Boolean);
        
        if (!origin) {
          // No Origin header means same-origin request - allow it
          // This is normal for server-to-server requests and some browser scenarios
          callback(null, true);
          return;
        }
        
        try {
          const requestOrigin = new URL(origin);
          
          const isAllowed = allowedOrigins.some(allowed => {
            if (!allowed) return false;
            try {
              const allowedOrigin = new URL(allowed);
              return requestOrigin.origin === allowedOrigin.origin;
            } catch {
              return false;
            }
          });
          
          if (isAllowed) {
            callback(null, true);
          } else {
            logger.warn('CORS blocked request', { 
              origin,
              allowedOrigins
            });
            callback(null, false);
          }
        } catch (error) {
          logger.error('Invalid Origin header', { origin });
          callback(null, false);
        }
      }
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'idempotency-key'],
  maxAge: 604800,
  optionsSuccessStatus: 200,
});
