import { describe, it, expect } from 'vitest';
import { User } from '../../models/User.js';

describe('User Model', () => {
  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'Test User';

      const user = await User.createUser(email, password, name);

      expect(user.email).toBe(email);
      expect(user.name).toBe(name);
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe(password);
      expect(user.preferences.editorTheme).toBe('light');
      expect(user.preferences.cursorColor).toBe('#000000');
    });

    it('should normalize email to lowercase', async () => {
      const email = 'Test@Example.COM';
      const user = await User.createUser(email, 'password123', 'Test User');

      expect(user.email).toBe('test@example.com');
    });

    it('should fail to create duplicate email', async () => {
      const email = 'duplicate@example.com';
      await User.createUser(email, 'password123', 'User 1');

      await expect(
        User.createUser(email, 'password456', 'User 2')
      ).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'find@example.com';
      await User.createUser(email, 'password123', 'Find User');

      const user = await User.findByEmail(email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it('should return null for non-existent email', async () => {
      const user = await User.findByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });

    it('should find user with case-insensitive email', async () => {
      const email = 'case@example.com';
      await User.createUser(email, 'password123', 'Case User');

      const user = await User.findByEmail('CASE@EXAMPLE.COM');

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });
  });

  describe('validatePassword', () => {
    it('should validate correct password', async () => {
      const password = 'correctPassword123';
      const user = await User.createUser(
        'validate@example.com',
        password,
        'Validate User'
      );

      const isValid = await user.validatePassword(password);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const user = await User.createUser(
        'reject@example.com',
        'correctPassword',
        'Reject User'
      );

      const isValid = await user.validatePassword('wrongPassword');

      expect(isValid).toBe(false);
    });
  });
});
