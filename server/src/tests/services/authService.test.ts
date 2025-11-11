import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../../services/authService.js';
import { User } from '../../models/User.js';
import '../setup.js';

describe('AuthService', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await User.createUser(
      'test@example.com',
      'password123',
      'Test User'
    );
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = authService.generateAccessToken(testUser);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should include user information in token payload', () => {
      const token = authService.generateAccessToken(testUser);
      const decoded = authService.verifyAccessToken(token);

      expect(decoded.userId).toBe(testUser._id.toString());
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.name).toBe(testUser.name);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = authService.generateRefreshToken(testUser);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should include user information in refresh token payload', () => {
      const token = authService.generateRefreshToken(testUser);
      const decoded = authService.verifyRefreshToken(token);

      expect(decoded.userId).toBe(testUser._id.toString());
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.name).toBe(testUser.name);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = authService.generateTokenPair(testUser);

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = authService.generateAccessToken(testUser);
      const decoded = authService.verifyAccessToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(testUser._id.toString());
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        authService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid access token');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        authService.verifyAccessToken('not.a.valid.jwt');
      }).toThrow('Invalid access token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = authService.generateRefreshToken(testUser);
      const decoded = authService.verifyRefreshToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(testUser._id.toString());
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        authService.verifyRefreshToken('invalid-token');
      }).toThrow('Invalid refresh token');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'test-token-123';
      const header = `Bearer ${token}`;
      const extracted = authService.extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = authService.extractTokenFromHeader(undefined);
      expect(extracted).toBeNull();
    });

    it('should return null for malformed header', () => {
      const extracted = authService.extractTokenFromHeader('InvalidFormat token');
      expect(extracted).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const extracted = authService.extractTokenFromHeader('token-only');
      expect(extracted).toBeNull();
    });
  });
});
