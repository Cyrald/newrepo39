import path from 'path';
import { logger } from './logger';

export interface PathValidationResult {
  isValid: boolean;
  normalizedPath?: string;
  error?: string;
}

export class PathSecurityValidator {
  private allowedBaseDir: string;

  constructor(baseDir: string) {
    this.allowedBaseDir = path.resolve(baseDir);
  }

  private sanitizeFilename(filename: string): string {
    let sanitized = filename;

    try {
      sanitized = decodeURIComponent(sanitized);
    } catch {
      sanitized = filename;
    }

    sanitized = sanitized.replace(/\x00/g, '');
    sanitized = sanitized.trim();

    return sanitized;
  }

  private isValidFilenameCharacters(filename: string): boolean {
    const invalidChars = /[<>:"|?*\x00-\x1F]/;
    if (invalidChars.test(filename)) {
      return false;
    }

    const allowedPattern = /^[\u0400-\u04FFa-zA-Z0-9._\-\s]+$/;
    return allowedPattern.test(filename);
  }

  validateFilename(filename: string): PathValidationResult {
    if (!filename || typeof filename !== 'string') {
      return {
        isValid: false,
        error: 'Filename must be a non-empty string'
      };
    }

    const sanitized = this.sanitizeFilename(filename);

    if (sanitized !== filename) {
      logger.warn('Filename sanitization detected potential attack', {
        original: filename,
        sanitized
      });
    }

    if (sanitized.length === 0) {
      return {
        isValid: false,
        error: 'Filename is empty after sanitization'
      };
    }

    if (sanitized.length > 255) {
      return {
        isValid: false,
        error: 'Filename too long (max 255 characters)'
      };
    }

    if (sanitized.includes('\x00')) {
      logger.warn('Path traversal attempt: null byte detected', { filename });
      return {
        isValid: false,
        error: 'Null byte detected in filename'
      };
    }

    if (sanitized.includes('..')) {
      logger.warn('Path traversal attempt: .. detected', { filename });
      return {
        isValid: false,
        error: 'Path traversal detected'
      };
    }

    if (sanitized.includes('/') || sanitized.includes('\\')) {
      logger.warn('Path traversal attempt: path separator detected', { filename });
      return {
        isValid: false,
        error: 'Path separators not allowed in filename'
      };
    }

    if (sanitized.startsWith('.')) {
      return {
        isValid: false,
        error: 'Hidden files not allowed'
      };
    }

    if (!this.isValidFilenameCharacters(sanitized)) {
      return {
        isValid: false,
        error: 'Invalid characters in filename (allowed: cyrillic, latin, numbers, . _ - space)'
      };
    }

    return {
      isValid: true,
      normalizedPath: sanitized
    };
  }

  validatePath(filename: string): PathValidationResult {
    const filenameValidation = this.validateFilename(filename);
    if (!filenameValidation.isValid) {
      return filenameValidation;
    }

    const normalizedFilename = filenameValidation.normalizedPath!;
    const fullPath = path.join(this.allowedBaseDir, normalizedFilename);
    const resolvedPath = path.resolve(fullPath);
    const resolvedBaseDir = path.resolve(this.allowedBaseDir);

    if (!resolvedPath.startsWith(resolvedBaseDir + path.sep) && resolvedPath !== resolvedBaseDir) {
      logger.error('Path traversal attempt: resolved path outside base directory', {
        filename,
        normalizedFilename,
        fullPath,
        resolvedPath,
        allowedBaseDir: resolvedBaseDir
      });
      return {
        isValid: false,
        error: 'Path traversal detected: resolved path outside allowed directory'
      };
    }

    const relativePath = path.relative(resolvedBaseDir, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      logger.error('Path traversal attempt: relative path escapes base directory', {
        filename,
        relativePath
      });
      return {
        isValid: false,
        error: 'Path traversal detected: path escapes base directory'
      };
    }

    return {
      isValid: true,
      normalizedPath: normalizedFilename
    };
  }

  getSecurePath(filename: string): string {
    const validation = this.validatePath(filename);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    return path.join(this.allowedBaseDir, validation.normalizedPath!);
  }
}
