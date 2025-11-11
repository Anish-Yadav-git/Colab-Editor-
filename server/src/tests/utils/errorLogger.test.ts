import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request } from 'express';
import {
  logError,
  logPermissionViolation,
  logAuthFailure,
  logValidationError,
  extractRequestContext,
  logOperation,
  logDatabaseError,
  logWebSocketError,
  ErrorContext,
} from '../../utils/errorLogger.js';
import logger from '../../config/logger.js';

// Mock logger
vi.mock('../../config/logger.js', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Error Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logError', () => {
    it('should log error with message and context', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        userId: 'user123',
        documentId: 'doc456',
      };

      logError('Operation failed', error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'Operation failed',
        expect.objectContaining({
          message: 'Operation failed',
          userId: 'user123',
          documentId: 'doc456',
          error: {
            name: 'Error',
            message: 'Test error',
            stack: expect.any(String),
          },
        })
      );
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error');
      error.name = 'CustomError';

      logError('Custom error occurred', error);

      expect(logger.error).toHaveBeenCalledWith(
        'Custom error occurred',
        expect.objectContaining({
          error: {
            name: 'CustomError',
            message: 'Test error',
            stack: expect.any(String),
          },
        })
      );
    });

    it('should handle non-Error objects', () => {
      const error = { code: 'CUSTOM_ERROR', details: 'Something went wrong' };

      logError('Non-standard error', error);

      expect(logger.error).toHaveBeenCalledWith(
        'Non-standard error',
        expect.objectContaining({
          error: { code: 'CUSTOM_ERROR', details: 'Something went wrong' },
        })
      );
    });

    it('should include stack trace for Error objects', () => {
      const error = new Error('Test error');

      logError('Error with stack', error);

      const logCall = vi.mocked(logger.error).mock.calls[0];
      expect(logCall[1]).toHaveProperty('error.stack');
      expect(logCall[1].error.stack).toContain('Error: Test error');
    });

    it('should merge context with error data', () => {
      const error = new Error('Test');
      const context: ErrorContext = {
        correlationId: 'corr-123',
        userId: 'user-456',
        operationType: 'insert',
        customField: 'custom-value',
      };

      logError('Test message', error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({
          correlationId: 'corr-123',
          userId: 'user-456',
          operationType: 'insert',
          customField: 'custom-value',
        })
      );
    });
  });

  describe('logPermissionViolation', () => {
    it('should log permission violation with required fields', () => {
      logPermissionViolation('user123', 'doc456', 'delete');

      expect(logger.warn).toHaveBeenCalledWith(
        'Permission violation detected',
        expect.objectContaining({
          userId: 'user123',
          documentId: 'doc456',
          attemptedAction: 'delete',
          timestamp: expect.any(String),
        })
      );
    });

    it('should include additional context', () => {
      const context: ErrorContext = {
        correlationId: 'corr-123',
        ip: '192.168.1.1',
      };

      logPermissionViolation('user123', 'doc456', 'edit', context);

      expect(logger.warn).toHaveBeenCalledWith(
        'Permission violation detected',
        expect.objectContaining({
          userId: 'user123',
          documentId: 'doc456',
          attemptedAction: 'edit',
          correlationId: 'corr-123',
          ip: '192.168.1.1',
        })
      );
    });

    it('should include ISO timestamp', () => {
      logPermissionViolation('user123', 'doc456', 'delete');

      const logCall = vi.mocked(logger.warn).mock.calls[0];
      const timestamp = logCall[1].timestamp;

      expect(timestamp).toBeDefined();
      expect(() => new Date(timestamp as string)).not.toThrow();
    });
  });

  describe('logAuthFailure', () => {
    it('should log authentication failure with reason', () => {
      logAuthFailure('Invalid token');

      expect(logger.warn).toHaveBeenCalledWith(
        'Authentication failure',
        expect.objectContaining({
          reason: 'Invalid token',
          timestamp: expect.any(String),
        })
      );
    });

    it('should include additional context', () => {
      const context: ErrorContext = {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      logAuthFailure('Token expired', context);

      expect(logger.warn).toHaveBeenCalledWith(
        'Authentication failure',
        expect.objectContaining({
          reason: 'Token expired',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });
  });

  describe('logValidationError', () => {
    it('should log validation error with field details', () => {
      logValidationError('email', 'invalid-email', 'Invalid email format');

      expect(logger.warn).toHaveBeenCalledWith(
        'Validation error',
        expect.objectContaining({
          field: 'email',
          value: 'invalid-email',
          reason: 'Invalid email format',
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle complex field values', () => {
      const complexValue = { nested: { field: 'value' } };

      logValidationError('data', complexValue, 'Invalid structure');

      expect(logger.warn).toHaveBeenCalledWith(
        'Validation error',
        expect.objectContaining({
          field: 'data',
          value: complexValue,
          reason: 'Invalid structure',
        })
      );
    });

    it('should include additional context', () => {
      const context: ErrorContext = {
        correlationId: 'corr-123',
        userId: 'user-456',
      };

      logValidationError('title', '', 'Title is required', context);

      expect(logger.warn).toHaveBeenCalledWith(
        'Validation error',
        expect.objectContaining({
          field: 'title',
          correlationId: 'corr-123',
          userId: 'user-456',
        })
      );
    });
  });

  describe('extractRequestContext', () => {
    it('should extract context from Express request', () => {
      const mockRequest = {
        correlationId: 'corr-123',
        user: { id: 'user-456' },
        method: 'POST',
        path: '/api/documents',
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      } as unknown as Request;

      const context = extractRequestContext(mockRequest);

      expect(context).toEqual({
        correlationId: 'corr-123',
        userId: 'user-456',
        method: 'POST',
        path: '/api/documents',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should handle missing user', () => {
      const mockRequest = {
        correlationId: 'corr-123',
        method: 'GET',
        path: '/api/health',
        ip: '192.168.1.1',
        headers: {},
      } as unknown as Request;

      const context = extractRequestContext(mockRequest);

      expect(context).toEqual({
        correlationId: 'corr-123',
        userId: undefined,
        method: 'GET',
        path: '/api/health',
        ip: '192.168.1.1',
        userAgent: undefined,
      });
    });

    it('should handle missing headers', () => {
      const mockRequest = {
        method: 'GET',
        path: '/test',
        headers: {},
      } as unknown as Request;

      const context = extractRequestContext(mockRequest);

      expect(context.userAgent).toBeUndefined();
    });
  });

  describe('logOperation', () => {
    it('should log successful operation with info level', () => {
      logOperation('insert', 'doc123', 'user456', true);

      expect(logger.info).toHaveBeenCalledWith(
        'Operation completed',
        expect.objectContaining({
          operationType: 'insert',
          documentId: 'doc123',
          userId: 'user456',
          success: true,
          timestamp: expect.any(String),
        })
      );
    });

    it('should log failed operation with error level', () => {
      logOperation('delete', 'doc123', 'user456', false);

      expect(logger.error).toHaveBeenCalledWith(
        'Operation failed',
        expect.objectContaining({
          operationType: 'delete',
          documentId: 'doc123',
          userId: 'user456',
          success: false,
          timestamp: expect.any(String),
        })
      );
    });

    it('should include additional context', () => {
      const context: ErrorContext = {
        correlationId: 'corr-123',
        latency: 50,
      };

      logOperation('update', 'doc123', 'user456', true, context);

      expect(logger.info).toHaveBeenCalledWith(
        'Operation completed',
        expect.objectContaining({
          correlationId: 'corr-123',
          latency: 50,
        })
      );
    });
  });

  describe('logDatabaseError', () => {
    it('should log database error with operation context', () => {
      const error = new Error('Connection timeout');

      logDatabaseError('findDocument', error);

      expect(logger.error).toHaveBeenCalledWith(
        'Database error during findDocument',
        expect.objectContaining({
          operation: 'findDocument',
          error: {
            name: 'Error',
            message: 'Connection timeout',
            stack: expect.any(String),
          },
        })
      );
    });

    it('should include additional context', () => {
      const error = new Error('Query failed');
      const context: ErrorContext = {
        documentId: 'doc123',
        userId: 'user456',
      };

      logDatabaseError('updateDocument', error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'Database error during updateDocument',
        expect.objectContaining({
          operation: 'updateDocument',
          documentId: 'doc123',
          userId: 'user456',
        })
      );
    });
  });

  describe('logWebSocketError', () => {
    it('should log WebSocket error with event context', () => {
      const error = new Error('Connection closed');

      logWebSocketError('disconnect', error);

      expect(logger.error).toHaveBeenCalledWith(
        'WebSocket error during disconnect',
        expect.objectContaining({
          event: 'disconnect',
          error: {
            name: 'Error',
            message: 'Connection closed',
            stack: expect.any(String),
          },
        })
      );
    });

    it('should include additional context', () => {
      const error = new Error('Message parse error');
      const context: ErrorContext = {
        userId: 'user123',
        documentId: 'doc456',
      };

      logWebSocketError('message', error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'WebSocket error during message',
        expect.objectContaining({
          event: 'message',
          userId: 'user123',
          documentId: 'doc456',
        })
      );
    });
  });
});
