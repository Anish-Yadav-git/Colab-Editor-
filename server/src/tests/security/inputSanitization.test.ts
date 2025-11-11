import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeTitle,
  sanitizeName,
  sanitizeEmail,
  validateOperationSize,
  validateDocumentSize,
  INPUT_LIMITS,
} from '../../middleware/inputSanitization.js';

describe('Input Sanitization', () => {
  describe('sanitizeString', () => {
    it('should remove null bytes and control characters', () => {
      const input = 'Hello\x00World\x01Test\x1F';
      const result = sanitizeString(input, 100);
      expect(result).toBe('HelloWorldTest');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeString(input, 100);
      expect(result).toBe('Hello World');
    });

    it('should limit string length', () => {
      const input = 'a'.repeat(300);
      const result = sanitizeString(input, 100);
      expect(result.length).toBe(100);
    });

    it('should handle empty strings', () => {
      const result = sanitizeString('', 100);
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = sanitizeString(null as any, 100);
      expect(result).toBe('');
    });

    it('should preserve newlines and tabs', () => {
      const input = 'Hello\nWorld\tTest';
      const result = sanitizeString(input, 100);
      expect(result).toBe('Hello\nWorld\tTest');
    });
  });

  describe('sanitizeTitle', () => {
    it('should sanitize and limit title length', () => {
      const input = 'a'.repeat(300);
      const result = sanitizeTitle(input);
      expect(result.length).toBe(INPUT_LIMITS.MAX_TITLE_LENGTH);
    });

    it('should remove control characters from title', () => {
      const input = 'My\x00Document\x01Title';
      const result = sanitizeTitle(input);
      expect(result).toBe('MyDocumentTitle');
    });

    it('should handle valid titles', () => {
      const input = 'My Document Title';
      const result = sanitizeTitle(input);
      expect(result).toBe('My Document Title');
    });
  });

  describe('sanitizeName', () => {
    it('should sanitize and limit name length', () => {
      const input = 'a'.repeat(200);
      const result = sanitizeName(input);
      expect(result.length).toBe(INPUT_LIMITS.MAX_NAME_LENGTH);
    });

    it('should remove control characters from name', () => {
      const input = 'John\x00Doe\x01';
      const result = sanitizeName(input);
      expect(result).toBe('JohnDoe');
    });

    it('should handle valid names', () => {
      const input = 'John Doe';
      const result = sanitizeName(input);
      expect(result).toBe('John Doe');
    });
  });

  describe('sanitizeEmail', () => {
    it('should sanitize and validate email', () => {
      const input = 'TEST@EXAMPLE.COM';
      const result = sanitizeEmail(input);
      expect(result).toBe('test@example.com');
    });

    it('should throw error for invalid email format', () => {
      expect(() => sanitizeEmail('invalid-email')).toThrow('Invalid email format');
    });

    it('should throw error for email without @', () => {
      expect(() => sanitizeEmail('testexample.com')).toThrow('Invalid email format');
    });

    it('should throw error for email without domain', () => {
      expect(() => sanitizeEmail('test@')).toThrow('Invalid email format');
    });

    it('should handle valid emails', () => {
      const input = 'user@example.com';
      const result = sanitizeEmail(input);
      expect(result).toBe('user@example.com');
    });

    it('should remove control characters from email', () => {
      const input = 'test\x00@example.com';
      const result = sanitizeEmail(input);
      expect(result).toBe('test@example.com');
    });
  });

  describe('validateOperationSize', () => {
    it('should accept operations within size limit', () => {
      const data = Buffer.alloc(1000); // 1KB
      expect(() => validateOperationSize(data)).not.toThrow();
    });

    it('should reject operations exceeding size limit', () => {
      const data = Buffer.alloc(2 * 1024 * 1024); // 2MB
      expect(() => validateOperationSize(data)).toThrow('Operation size');
    });

    it('should handle Uint8Array', () => {
      const data = new Uint8Array(1000);
      expect(() => validateOperationSize(data)).not.toThrow();
    });

    it('should handle string data', () => {
      const data = 'a'.repeat(1000);
      expect(() => validateOperationSize(data)).not.toThrow();
    });

    it('should reject large string data', () => {
      const data = 'a'.repeat(2 * 1024 * 1024);
      expect(() => validateOperationSize(data)).toThrow('Operation size');
    });

    it('should throw error for invalid data type', () => {
      expect(() => validateOperationSize(123 as any)).toThrow('Invalid data type');
    });
  });

  describe('validateDocumentSize', () => {
    it('should accept documents within size limit', () => {
      const data = Buffer.alloc(5 * 1024 * 1024); // 5MB
      expect(() => validateDocumentSize(data)).not.toThrow();
    });

    it('should reject documents exceeding size limit', () => {
      const data = Buffer.alloc(11 * 1024 * 1024); // 11MB
      expect(() => validateDocumentSize(data)).toThrow('Document size');
    });

    it('should handle Uint8Array', () => {
      const data = new Uint8Array(5 * 1024 * 1024);
      expect(() => validateDocumentSize(data)).not.toThrow();
    });

    it('should handle string data', () => {
      const data = 'a'.repeat(5 * 1024 * 1024);
      expect(() => validateDocumentSize(data)).not.toThrow();
    });

    it('should reject large string data', () => {
      const data = 'a'.repeat(11 * 1024 * 1024);
      expect(() => validateDocumentSize(data)).toThrow('Document size');
    });

    it('should throw error for invalid data type', () => {
      expect(() => validateDocumentSize({ data: 'test' } as any)).toThrow('Invalid data type');
    });
  });

  describe('INPUT_LIMITS', () => {
    it('should export correct limits', () => {
      expect(INPUT_LIMITS.MAX_OPERATION_SIZE).toBe(1 * 1024 * 1024);
      expect(INPUT_LIMITS.MAX_DOCUMENT_SIZE).toBe(10 * 1024 * 1024);
      expect(INPUT_LIMITS.MAX_TITLE_LENGTH).toBe(200);
      expect(INPUT_LIMITS.MAX_NAME_LENGTH).toBe(100);
      expect(INPUT_LIMITS.MAX_EMAIL_LENGTH).toBe(255);
    });
  });
});
