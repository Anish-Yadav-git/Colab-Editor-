import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

// Maximum sizes
const MAX_OPERATION_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 255;

/**
 * Sanitize string input by removing potentially dangerous characters
 * and limiting length
 */
export function sanitizeString(input: string, maxLength: number): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters (except newlines and tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize document title
 */
export function sanitizeTitle(title: string): string {
  return sanitizeString(title, MAX_TITLE_LENGTH);
}

/**
 * Sanitize user name
 */
export function sanitizeName(name: string): string {
  return sanitizeString(name, MAX_NAME_LENGTH);
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email, MAX_EMAIL_LENGTH);
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }
  return sanitized.toLowerCase();
}

/**
 * Validate operation size
 */
export function validateOperationSize(data: Buffer | Uint8Array | string): void {
  let size: number;

  if (Buffer.isBuffer(data)) {
    size = data.length;
  } else if (data instanceof Uint8Array) {
    size = data.byteLength;
  } else if (typeof data === 'string') {
    size = Buffer.byteLength(data, 'utf8');
  } else {
    throw new Error('Invalid data type for operation');
  }

  if (size > MAX_OPERATION_SIZE) {
    throw new Error(
      `Operation size ${size} bytes exceeds maximum ${MAX_OPERATION_SIZE} bytes`
    );
  }
}

/**
 * Validate document size
 */
export function validateDocumentSize(data: Buffer | Uint8Array | string): void {
  let size: number;

  if (Buffer.isBuffer(data)) {
    size = data.length;
  } else if (data instanceof Uint8Array) {
    size = data.byteLength;
  } else if (typeof data === 'string') {
    size = Buffer.byteLength(data, 'utf8');
  } else {
    throw new Error('Invalid data type for document');
  }

  if (size > MAX_DOCUMENT_SIZE) {
    throw new Error(
      `Document size ${size} bytes exceeds maximum ${MAX_DOCUMENT_SIZE} bytes`
    );
  }
}

/**
 * Middleware to sanitize request body fields
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction): void {
  try {
    if (req.body) {
      // Sanitize common fields
      if (req.body.title) {
        req.body.title = sanitizeTitle(req.body.title);
      }

      if (req.body.name) {
        req.body.name = sanitizeName(req.body.name);
      }

      if (req.body.email) {
        try {
          req.body.email = sanitizeEmail(req.body.email);
        } catch (error) {
          return res.status(400).json({
            error: 'Invalid email format',
          });
        }
      }

      // Validate content size if present
      if (req.body.content) {
        try {
          validateDocumentSize(req.body.content);
        } catch (error) {
          logger.warn('Document size validation failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            correlationId: req.headers['x-correlation-id'],
          });
          return res.status(400).json({
            error: error instanceof Error ? error.message : 'Document size validation failed',
          });
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.headers['x-correlation-id'],
    });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * Middleware to validate request body size
 */
export function validateRequestSize(req: Request, res: Response, next: NextFunction): void {
  const contentLength = req.headers['content-length'];

  if (contentLength) {
    const size = parseInt(contentLength, 10);

    if (size > MAX_DOCUMENT_SIZE) {
      logger.warn('Request size exceeds limit', {
        size,
        maxSize: MAX_DOCUMENT_SIZE,
        correlationId: req.headers['x-correlation-id'],
      });
      return res.status(413).json({
        error: `Request size ${size} bytes exceeds maximum ${MAX_DOCUMENT_SIZE} bytes`,
      });
    }
  }

  next();
}

// Export constants for use in other modules
export const INPUT_LIMITS = {
  MAX_OPERATION_SIZE,
  MAX_DOCUMENT_SIZE,
  MAX_TITLE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
};
