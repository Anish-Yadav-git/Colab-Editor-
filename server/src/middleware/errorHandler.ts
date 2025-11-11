import { Request, Response, NextFunction } from 'express';
import { logError, extractRequestContext } from '../utils/errorLogger.js';

/**
 * Global error handling middleware
 * Catches all errors and logs them with context
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Extract context from request
  const context = extractRequestContext(req);

  // Add document ID if present in params
  if (req.params.id) {
    context.documentId = req.params.id;
  }

  // Log error with full context
  logError('Unhandled error in request', error, context);

  // Determine status code
  let statusCode = 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not found';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Send error response
  res.status(statusCode).json({
    error: message,
    correlationId: req.correlationId,
    // Include error details in development
    ...(process.env.NODE_ENV !== 'production' && {
      details: error.message,
      stack: error.stack,
    }),
  });
};
