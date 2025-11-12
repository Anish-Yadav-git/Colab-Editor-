import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { User } from '../../models/User.js';
import { updatePreferences } from '../../controllers/authController.js';
import { verifyToken } from '../../middleware/auth.js';

// Mock the User model
vi.mock('../../models/User.js', () => ({
  User: {
    findById: vi.fn(),
  },
}));

// Mock the auth middleware
vi.mock('../../middleware/auth.js', () => ({
  verifyToken: vi.fn((req, res, next) => {
    req.user = { userId: 'test-user-id' };
    next();
  }),
}));

describe('Auth Controller - Update Preferences', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.patch('/api/auth/preferences', verifyToken, updatePreferences);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should update user preferences successfully', async () => {
    const mockUser = {
      _id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        editorTheme: 'light',
        cursorColor: '#000000',
        avatarUrl: undefined,
      },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(User.findById).mockResolvedValue(mockUser as any);

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        editorTheme: 'dark',
        cursorColor: '#ff0000',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Preferences updated successfully');
    expect(response.body.preferences.editorTheme).toBe('dark');
    expect(response.body.preferences.cursorColor).toBe('#ff0000');
    expect(response.body.preferences.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(mockUser.save).toHaveBeenCalled();
  });

  it('should update only provided preferences', async () => {
    const mockUser = {
      _id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        editorTheme: 'light',
        cursorColor: '#000000',
        avatarUrl: 'https://example.com/old-avatar.jpg',
      },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(User.findById).mockResolvedValue(mockUser as any);

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        avatarUrl: 'https://example.com/new-avatar.jpg',
      });

    expect(response.status).toBe(200);
    expect(response.body.preferences.editorTheme).toBe('light'); // Unchanged
    expect(response.body.preferences.cursorColor).toBe('#000000'); // Unchanged
    expect(response.body.preferences.avatarUrl).toBe('https://example.com/new-avatar.jpg'); // Updated
  });

  it('should reject invalid avatar URL', async () => {
    const mockUser = {
      _id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        editorTheme: 'light',
        cursorColor: '#000000',
      },
      save: vi.fn(),
    };

    vi.mocked(User.findById).mockResolvedValue(mockUser as any);

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        avatarUrl: 'not-a-valid-url',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation error');
    expect(response.body.message).toBe('Invalid avatar URL format');
    expect(mockUser.save).not.toHaveBeenCalled();
  });

  it('should allow clearing avatar URL with empty string', async () => {
    const mockUser = {
      _id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        editorTheme: 'light',
        cursorColor: '#000000',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(User.findById).mockResolvedValue(mockUser as any);

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        avatarUrl: '',
      });

    expect(response.status).toBe(200);
    expect(response.body.preferences.avatarUrl).toBeUndefined();
    expect(mockUser.save).toHaveBeenCalled();
  });

  it('should return 401 if user not authenticated', async () => {
    // Override the mock for this test
    vi.mocked(verifyToken).mockImplementationOnce((req, res, next) => {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    });

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        editorTheme: 'dark',
      });

    expect(response.status).toBe(401);
  });

  it('should return 404 if user not found', async () => {
    vi.mocked(User.findById).mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        editorTheme: 'dark',
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not found');
    expect(response.body.message).toBe('User not found');
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(User.findById).mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        editorTheme: 'dark',
      });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to update preferences');
  });

  it('should accept valid HTTPS avatar URLs', async () => {
    const mockUser = {
      _id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        editorTheme: 'light',
        cursorColor: '#000000',
      },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(User.findById).mockResolvedValue(mockUser as any);

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        avatarUrl: 'https://cdn.example.com/avatars/user123.png',
      });

    expect(response.status).toBe(200);
    expect(response.body.preferences.avatarUrl).toBe('https://cdn.example.com/avatars/user123.png');
  });

  it('should accept valid HTTP avatar URLs', async () => {
    const mockUser = {
      _id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        editorTheme: 'light',
        cursorColor: '#000000',
      },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(User.findById).mockResolvedValue(mockUser as any);

    const response = await request(app)
      .patch('/api/auth/preferences')
      .send({
        avatarUrl: 'http://example.com/avatar.jpg',
      });

    expect(response.status).toBe(200);
    expect(response.body.preferences.avatarUrl).toBe('http://example.com/avatar.jpg');
  });
});
