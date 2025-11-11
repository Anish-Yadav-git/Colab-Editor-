import { describe, it, expect } from 'vitest';
import {
  validateDocumentTitle,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateName,
  validateForm,
} from './validation';

describe('Validation Utils', () => {
  describe('validateDocumentTitle', () => {
    it('validates valid title', () => {
      const result = validateDocumentTitle('My Document');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects empty title', () => {
      const result = validateDocumentTitle('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Document title is required');
    });

    it('rejects whitespace-only title', () => {
      const result = validateDocumentTitle('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Document title is required');
    });

    it('rejects title exceeding 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      const result = validateDocumentTitle(longTitle);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Document title must not exceed 200 characters');
    });

    it('accepts title with exactly 200 characters', () => {
      const title = 'a'.repeat(200);
      const result = validateDocumentTitle(title);
      expect(result.isValid).toBe(true);
    });

    it('accepts title with 1 character', () => {
      const result = validateDocumentTitle('a');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('validates valid email', () => {
      const result = validateEmail('user@example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('validates email with subdomain', () => {
      const result = validateEmail('user@mail.example.com');
      expect(result.isValid).toBe(true);
    });

    it('validates email with plus sign', () => {
      const result = validateEmail('user+tag@example.com');
      expect(result.isValid).toBe(true);
    });

    it('rejects empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('rejects email without @', () => {
      const result = validateEmail('userexample.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('rejects email without domain', () => {
      const result = validateEmail('user@');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('rejects email without TLD', () => {
      const result = validateEmail('user@example');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('rejects email with spaces', () => {
      const result = validateEmail('user @example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('rejects email exceeding 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email address is too long');
    });
  });

  describe('validatePassword', () => {
    it('validates valid password', () => {
      const result = validatePassword('Password123!');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('rejects password shorter than 8 characters', () => {
      const result = validatePassword('Pass1!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters long');
    });

    it('rejects password longer than 128 characters', () => {
      const longPassword = 'Password123!' + 'a'.repeat(120);
      const result = validatePassword(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must not exceed 128 characters');
    });

    it('rejects password without uppercase letter', () => {
      const result = validatePassword('password123!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least one uppercase letter');
    });

    it('rejects password without lowercase letter', () => {
      const result = validatePassword('PASSWORD123!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least one lowercase letter');
    });

    it('rejects password without number', () => {
      const result = validatePassword('Password!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least one number');
    });

    it('rejects password without special character', () => {
      const result = validatePassword('Password123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least one special character');
    });

    it('accepts password with various special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{};\':"|,.<>/?';
      for (const char of specialChars) {
        const result = validatePassword(`Password123${char}`);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('validates matching passwords', () => {
      const result = validatePasswordConfirmation('Password123!', 'Password123!');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects empty confirmation', () => {
      const result = validatePasswordConfirmation('Password123!', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please confirm your password');
    });

    it('rejects non-matching passwords', () => {
      const result = validatePasswordConfirmation('Password123!', 'Different123!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Passwords do not match');
    });
  });

  describe('validateName', () => {
    it('validates valid name', () => {
      const result = validateName('John Doe');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects empty name', () => {
      const result = validateName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('rejects whitespace-only name', () => {
      const result = validateName('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('rejects name shorter than 2 characters', () => {
      const result = validateName('J');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name must be at least 2 characters');
    });

    it('rejects name longer than 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = validateName(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name must not exceed 100 characters');
    });

    it('accepts name with exactly 2 characters', () => {
      const result = validateName('Jo');
      expect(result.isValid).toBe(true);
    });

    it('accepts name with exactly 100 characters', () => {
      const name = 'a'.repeat(100);
      const result = validateName(name);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateForm', () => {
    it('validates all fields and returns no errors for valid data', () => {
      const fields = {
        email: 'user@example.com',
        password: 'Password123!',
        name: 'John Doe',
      };

      const validators = {
        email: validateEmail,
        password: validatePassword,
        name: validateName,
      };

      const errors = validateForm(fields, validators);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('returns errors for invalid fields', () => {
      const fields = {
        email: 'invalid-email',
        password: 'weak',
        name: 'J',
      };

      const validators = {
        email: validateEmail,
        password: validatePassword,
        name: validateName,
      };

      const errors = validateForm(fields, validators);
      expect(errors.email).toBe('Please enter a valid email address');
      expect(errors.password).toBe('Password must be at least 8 characters long');
      expect(errors.name).toBe('Name must be at least 2 characters');
    });

    it('validates only specified fields', () => {
      const fields = {
        email: 'user@example.com',
        password: 'Password123!',
        extraField: 'value',
      };

      const validators = {
        email: validateEmail,
        password: validatePassword,
      };

      const errors = validateForm(fields, validators);
      expect(Object.keys(errors)).toHaveLength(0);
      expect(errors.extraField).toBeUndefined();
    });
  });
});
