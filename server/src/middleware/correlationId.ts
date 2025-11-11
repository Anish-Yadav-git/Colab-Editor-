import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware to add correlation ID to each request
 * Generates a unique UUID for each request to enable request tracing
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if correlation ID is provided in headers, otherwise generate new one
  const correlationId =
    (req.headers['x-correlation-id'] as string) || randomUUID();

  // Attach to request object
  req.correlationId = correlationId;

  // Add to response headers for client tracking
  res.setHeader('X-Correlation-ID', correlationId);

  next();
};
