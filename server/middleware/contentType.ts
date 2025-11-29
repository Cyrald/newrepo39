import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requireJSON(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    logger.warn('Invalid Content-Type for JSON endpoint', {
      path: req.path,
      method: req.method,
      contentType,
      ip: req.ip,
    });
    
    res.status(415).json({
      message: 'Content-Type должен быть application/json',
    });
    return;
  }
  
  next();
}

export function requireMultipart(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.get('content-type');
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    logger.warn('Invalid Content-Type for multipart endpoint', {
      path: req.path,
      method: req.method,
      contentType,
      ip: req.ip,
    });
    
    res.status(415).json({
      message: 'Content-Type должен быть multipart/form-data',
    });
    return;
  }
  
  next();
}
