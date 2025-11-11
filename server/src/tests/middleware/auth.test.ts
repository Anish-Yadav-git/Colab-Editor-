import { Request, Response, NextFunction } from 'express';
import { verifyToken, checkDocumentPermission } from '../../middleware/auth.js';
import { authService } from '../../services/authService.js';
import { User } from '../../models/User.js';
import { Document } from '../../models/Document.js';
import mongoose from 'mongoose';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the services and models
vi.mock('../../services/authService.js');
vi.mock('../../models/User.js');
vi.mock('../../models/Document.js');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {},
      params: {},
      user: undefined,
    };

    mockResponse = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    nextFunction = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should return 401 when no token is provided', async () => {
      mockRequest.headers = {};
      vi.mocked(authService.extractTokenFromHeader).mockReturnValue(null);

      await verifyToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'No token provided',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', async () => {
      mockRequest.headers = { authorization: 'Bearer expired-token' };
      vi.mocked(authService.extractTokenFromHeader).mockReturnValue('expired-token');
      vi.mocked(authService.verifyAccessToken).mockImplementation(() => {
        throw new Error('Access token expired');
      });

      await verifyToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Token expired',
        message: 'Please refresh your token',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(authService.extractTokenFromHeader).mockReturnValue('invalid-token');
      vi.mocked(authService.verifyAccessToken).mockImplementation(() => {
        throw new Error('Invalid access token');
      });

      await verifyToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid token',
        message: 'Token is malformed or invalid',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found in database', async () => {
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(authService.extractTokenFromHeader).mockReturnValue('valid-token');
      vi.mocked(authService.verifyAccessToken).mockReturnValue(mockPayload);
      vi.mocked(User.findById).mockResolvedValue(null);

      await verifyToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'User not found',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should attach user info to request and call next on valid token', async () => {
      const validUserId = new mongoose.Types.ObjectId();
      const mockPayload = {
        userId: validUserId.toString(),
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockUser = {
        _id: validUserId,
        email: 'test@example.com',
        name: 'Test User',
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(authService.extractTokenFromHeader).mockReturnValue('valid-token');
      vi.mocked(authService.verifyAccessToken).mockReturnValue(mockPayload);
      vi.mocked(User.findById).mockResolvedValue(mockUser as any);

      await verifyToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user).toEqual({
        userId: validUserId.toString(),
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 500 on unexpected errors', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(authService.extractTokenFromHeader).mockReturnValue('valid-token');
      vi.mocked(authService.verifyAccessToken).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await verifyToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication error',
        message: 'An error occurred during authentication',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('checkDocumentPermission', () => {
    const userId = new mongoose.Types.ObjectId();
    const documentId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    beforeEach(() => {
      mockRequest.user = {
        userId: userId.toString(),
        email: 'test@example.com',
        name: 'Test User',
      };
      mockRequest.params = { id: documentId.toString() };
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;
      const middleware = checkDocumentPermission('read');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when document ID is missing', async () => {
      mockRequest.params = {};
      const middleware = checkDocumentPermission('read');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Bad request',
        message: 'Document ID is required',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 404 when document is not found', async () => {
      vi.mocked(Document.findById).mockResolvedValue(null);
      const middleware = checkDocumentPermission('read');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Not found',
        message: 'Document not found',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 404 when document is deleted', async () => {
      const mockDocument = {
        _id: documentId,
        ownerId: ownerId,
        isDeleted: true,
        permissions: [],
      };

      vi.mocked(Document.findById).mockResolvedValue(mockDocument as any);
      const middleware = checkDocumentPermission('read');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Not found',
        message: 'Document has been deleted',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow owner to have all permissions', async () => {
      const mockDocument = {
        _id: documentId,
        ownerId: userId,
        isDeleted: false,
        permissions: [{ userId: userId, role: 'owner' }],
      };

      vi.mocked(Document.findById).mockResolvedValue(mockDocument as any);
      const middleware = checkDocumentPermission('admin');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow viewer to read', async () => {
      const mockDocument = {
        _id: documentId,
        ownerId: ownerId,
        isDeleted: false,
        permissions: [{ userId: userId, role: 'viewer' }],
      };

      vi.mocked(Document.findById).mockResolvedValue(mockDocument as any);
      const middleware = checkDocumentPermission('read');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny viewer from writing', async () => {
      const mockDocument = {
        _id: documentId,
        ownerId: ownerId,
        isDeleted: false,
        permissions: [{ userId: userId, role: 'viewer' }],
      };

      vi.mocked(Document.findById).mockResolvedValue(mockDocument as any);
      const middleware = checkDocumentPermission('write');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You do not have write permission for this document',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow editor to write', async () => {
      const mockDocument = {
        _id: documentId,
        ownerId: ownerId,
        isDeleted: false,
        permissions: [{ userId: userId, role: 'editor' }],
      };

      vi.mocked(Document.findById).mockResolvedValue(mockDocument as any);
      const middleware = checkDocumentPermission('write');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny editor from admin actions', async () => {
      const mockDocument = {
        _id: documentId,
        ownerId: ownerId,
        isDeleted: false,
        permissions: [{ userId: userId, role: 'editor' }],
      };

      vi.mocked(Document.findById).mockResolvedValue(mockDocument as any);
      const middleware = checkDocumentPermission('admin');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You do not have admin permission for this document',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should deny access when user has no permissions', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const mockDocument = {
        _id: documentId,
        ownerId: ownerId,
        isDeleted: false,
        permissions: [{ userId: otherUserId, role: 'editor' }],
      };

      vi.mocked(Document.findById).mockResolvedValue(mockDocument as any);
      const middleware = checkDocumentPermission('read');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You do not have read permission for this document',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle documentId from params.documentId', async () => {
      mockRequest.params = { documentId: documentId.toString() };
      const mockDocument = {
        _id: documentId,
        ownerId: userId,
        isDeleted: false,
        permissions: [{ userId: userId, role: 'owner' }],
      };

      vi.mocked(Document.findById).mockResolvedValue(mockDocument as any);
      const middleware = checkDocumentPermission('read');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 500 on database errors', async () => {
      vi.mocked(Document.findById).mockRejectedValue(new Error('Database error'));
      const middleware = checkDocumentPermission('read');

      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Permission check failed',
        message: 'An error occurred while checking permissions',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
