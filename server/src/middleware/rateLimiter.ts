import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../config/logger.js';

// General API rate limiter - 100 requests per minute per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      correlationId: req.headers['x-correlation-id'],
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
    });
  },
});

// Document creation rate limiter - 10 documents per hour per user
export const documentCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many documents created, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID from authenticated request
    return (req as any).user?.id || req.ip || 'anonymous';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Document creation rate limit exceeded', {
      userId: (req as any).user?.id,
      ip: req.ip,
      correlationId: req.headers['x-correlation-id'],
    });
    res.status(429).json({
      error: 'Too many documents created, please try again later.',
    });
  },
});

// Auth rate limiter - stricter limits for login/register endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      correlationId: req.headers['x-correlation-id'],
    });
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
    });
  },
});
