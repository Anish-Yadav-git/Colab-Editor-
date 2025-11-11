import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import {
  logAuthFailure,
  logPermissionViolation,
  extractRequestContext,
} from '../utils/errorLogger.js';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        name: string;
      };
    }
  }
}

/**
 * Middleware to verify JWT token and attach user info to request
 * Extracts token from Authorization header and validates it
 */
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const token = authService.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      logAuthFailure('No token provided', extractRequestContext(req));
      res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided',
      });
      return;
    }

    // Verify token
    const decoded = authService.verifyAccessToken(token);

    // Verify user still exists in database
    const user = await User.findById(decoded.userId);
    if (!user) {
      logAuthFailure('User not found', {
        ...extractRequestContext(req),
        userId: decoded.userId,
      });
      res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found',
      });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Access token expired') {
        logAuthFailure('Token expired', extractRequestContext(req));
        res.status(401).json({
          error: 'Token expired',
          message: 'Please refresh your token',
        });
        return;
      } else if (error.message === 'Invalid access token') {
        logAuthFailure('Invalid token', extractRequestContext(req));
        res.status(401).json({
          error: 'Invalid token',
          message: 'Token is malformed or invalid',
        });
        return;
      }
    }

    logAuthFailure('Authentication error', {
      ...extractRequestContext(req),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Middleware factory to check document permissions
 * Verifies that the authenticated user has the required permission level
 */
export const checkDocumentPermission = (
  requiredPermission: 'read' | 'write' | 'admin'
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated',
        });
        return;
      }

      // Extract document ID from params
      const documentId = req.params.id || req.params.documentId;
      if (!documentId) {
        res.status(400).json({
          error: 'Bad request',
          message: 'Document ID is required',
        });
        return;
      }

      // Fetch document
      const document = await Document.findById(documentId);
      if (!document) {
        res.status(404).json({
          error: 'Not found',
          message: 'Document not found',
        });
        return;
      }

      // Check if document is deleted
      if (document.isDeleted) {
        res.status(404).json({
          error: 'Not found',
          message: 'Document has been deleted',
        });
        return;
      }

      const userId = req.user.userId;

      // Check if user is owner
      const isOwner = document.ownerId.toString() === userId;

      // Find user's permission in document
      const userPermission = document.permissions.find(
        (p) => p.userId.toString() === userId
      );

      // Determine if user has required permission
      let hasPermission = false;

      if (isOwner) {
        // Owner has all permissions
        hasPermission = true;
      } else if (userPermission) {
        const role = userPermission.role;

        switch (requiredPermission) {
          case 'read':
            // All roles can read
            hasPermission = ['owner', 'editor', 'viewer'].includes(role);
            break;
          case 'write':
            // Only owner and editor can write
            hasPermission = ['owner', 'editor'].includes(role);
            break;
          case 'admin':
            // Only owner has admin permissions
            hasPermission = role === 'owner';
            break;
        }
      }

      if (!hasPermission) {
        logPermissionViolation(
          userId,
          documentId,
          requiredPermission,
          extractRequestContext(req)
        );
        res.status(403).json({
          error: 'Forbidden',
          message: `You do not have ${requiredPermission} permission for this document`,
        });
        return;
      }

      next();
    } catch (error) {
      logAuthFailure('Permission check error', {
        ...extractRequestContext(req),
        documentId: req.params.id || req.params.documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Permission check failed',
        message: 'An error occurred while checking permissions',
      });
    }
  };
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = authService.extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const decoded = authService.verifyAccessToken(token);
      const user = await User.findById(decoded.userId);

      if (user) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          name: decoded.name,
        };
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};
