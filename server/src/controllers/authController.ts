import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { authService } from '../services/authService.js';
import {
  logError,
  logValidationError,
  extractRequestContext,
} from '../utils/errorLogger.js';

/**
 * Register a new user account
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      logValidationError(
        'registration',
        { email: !!email, password: !!password, name: !!name },
        'Missing required fields',
        extractRequestContext(req)
      );
      res.status(400).json({
        error: 'Validation error',
        message: 'Email, password, and name are required',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logValidationError(
        'email',
        email,
        'Invalid email format',
        extractRequestContext(req)
      );
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid email format',
      });
      return;
    }

    // Validate password strength (min 8 characters)
    if (password.length < 8) {
      logValidationError(
        'password',
        `length: ${password.length}`,
        'Password too short',
        extractRequestContext(req)
      );
      res.status(400).json({
        error: 'Validation error',
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    // Validate name length
    if (name.trim().length < 1 || name.length > 100) {
      logValidationError(
        'name',
        `length: ${name.length}`,
        'Invalid name length',
        extractRequestContext(req)
      );
      res.status(400).json({
        error: 'Validation error',
        message: 'Name must be between 1 and 100 characters',
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists',
      });
      return;
    }

    // Create new user
    const user = await User.createUser(email, password, name);

    // Generate tokens
    const tokens = authService.generateTokenPair(user);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    logError('Registration error', error, {
      ...extractRequestContext(req),
      operationType: 'register',
    });
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration',
    });
  }
};

/**
 * Login with existing credentials
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
      return;
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
      return;
    }

    // Validate password
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate tokens
    const tokens = authService.generateTokenPair(user);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        preferences: user.preferences,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    logError('Login error', error, {
      ...extractRequestContext(req),
      operationType: 'login',
    });
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login',
    });
  }
};

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    // Validate input
    if (!refreshToken) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Refresh token is required',
      });
      return;
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = authService.verifyRefreshToken(refreshToken);
    } catch (error) {
      res.status(401).json({
        error: 'Invalid token',
        message: error instanceof Error ? error.message : 'Invalid refresh token',
      });
      return;
    }

    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found',
      });
      return;
    }

    // Generate new access token
    const accessToken = authService.generateAccessToken(user);

    res.status(200).json({
      message: 'Token refreshed successfully',
      accessToken,
    });
  } catch (error) {
    logError('Token refresh error', error, {
      ...extractRequestContext(req),
      operationType: 'refresh_token',
    });
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'An error occurred during token refresh',
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    logError('Get current user error', error, {
      ...extractRequestContext(req),
      operationType: 'get_current_user',
    });
    res.status(500).json({
      error: 'Failed to get user',
      message: 'An error occurred while fetching user data',
    });
  }
};
