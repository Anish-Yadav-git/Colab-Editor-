import logger from '../config/logger.js';
import { Request } from 'express';

/**
 * Context information for error logging
 */
export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  documentId?: string;
  operationType?: string;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

/**
 * Log an error with full context and stack trace
 */
export const logError = (
  message: string,
  error: Error | unknown,
  context: ErrorContext = {}
): void => {
  const errorData: Record<string, unknown> = {
    message,
    ...context,
  };

  // Add error details
  if (error instanceof Error) {
    errorData.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else {
    errorData.error = error;
  }

  logger.error(message, errorData);
};

/**
 * Log a permission violation with security context
 */
export const logPermissionViolation = (
  userId: string,
  documentId: string,
  attemptedAction: string,
  context: ErrorContext = {}
): void => {
  logger.warn('Permission violation detected', {
    userId,
    documentId,
    attemptedAction,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

/**
 * Log an authentication failure
 */
export const logAuthFailure = (
  reason: string,
  context: ErrorContext = {}
): void => {
  logger.warn('Authentication failure', {
    reason,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

/**
 * Log a validation error
 */
export const logValidationError = (
  field: string,
  value: unknown,
  reason: string,
  context: ErrorContext = {}
): void => {
  logger.warn('Validation error', {
    field,
    value,
    reason,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

/**
 * Extract error context from Express request
 */
export const extractRequestContext = (req: Request): ErrorContext => {
  return {
    correlationId: req.correlationId,
    userId: (req as any).user?.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
};

/**
 * Log an operation with context
 */
export const logOperation = (
  operationType: string,
  documentId: string,
  userId: string,
  success: boolean,
  context: ErrorContext = {}
): void => {
  const logData = {
    operationType,
    documentId,
    userId,
    success,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (success) {
    logger.info('Operation completed', logData);
  } else {
    logger.error('Operation failed', logData);
  }
};

/**
 * Log a database error with context
 */
export const logDatabaseError = (
  operation: string,
  error: Error | unknown,
  context: ErrorContext = {}
): void => {
  logError(`Database error during ${operation}`, error, {
    operation,
    ...context,
  });
};

/**
 * Log a WebSocket error with context
 */
export const logWebSocketError = (
  event: string,
  error: Error | unknown,
  context: ErrorContext = {}
): void => {
  logError(`WebSocket error during ${event}`, error, {
    event,
    ...context,
  });
};
