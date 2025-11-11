import { describe, it, expect } from 'vitest';
import winston from 'winston';
import logger from '../../config/logger.js';

describe('Logger Configuration', () => {
  describe('logger instance', () => {
    it('should be a winston logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.level).toBeDefined();
    });

    it('should have a valid log level', () => {
      const validLevels = ['error', 'warn', 'info', 'debug'];
      expect(validLevels).toContain(logger.level);
    });
  });

  describe('transports', () => {
    it('should have at least one transport', () => {
      expect(logger.transports.length).toBeGreaterThan(0);
    });

    it('should use console transport', () => {
      const hasConsoleTransport = logger.transports.some(
        transport => transport instanceof winston.transports.Console
      );
      
      expect(hasConsoleTransport).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should not exit on error', () => {
      expect(logger.exitOnError).toBe(false);
    });
  });

  describe('logging methods', () => {
    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should have info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('structured logging', () => {
    it('should support logging with metadata', () => {
      // Should not throw when logging with metadata
      expect(() => {
        logger.info('Test message', {
          userId: 'user123',
          documentId: 'doc456',
          operationType: 'insert',
        });
      }).not.toThrow();
    });

    it('should support logging errors with stack traces', () => {
      const error = new Error('Test error');
      
      // Should not throw when logging errors
      expect(() => {
        logger.error('Error occurred', {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        });
      }).not.toThrow();
    });

    it('should support logging with complex objects', () => {
      expect(() => {
        logger.info('Complex log', {
          user: { id: '123', name: 'Test User' },
          document: { id: 'doc456', title: 'Test Doc' },
          metadata: { timestamp: new Date(), count: 42 },
        });
      }).not.toThrow();
    });
  });

  describe('log levels hierarchy', () => {
    it('should respect log level hierarchy', () => {
      // Winston log levels: error: 0, warn: 1, info: 2, debug: 3
      const levels = ['error', 'warn', 'info', 'debug'];
      const currentLevelIndex = levels.indexOf(logger.level);
      
      expect(currentLevelIndex).toBeGreaterThanOrEqual(0);
      expect(currentLevelIndex).toBeLessThan(levels.length);
    });
  });
});
