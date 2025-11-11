import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Document } from '../models/Document.js';
import {
  logError,
  logValidationError,
  logOperation,
  extractRequestContext,
} from '../utils/errorLogger.js';

/**
 * Create a new document
 * POST /api/documents
 */
export const createDocument = async (
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

    const { title } = req.body;

    // Validate title
    if (!title || typeof title !== 'string') {
      logValidationError(
        'title',
        title,
        'Title is required and must be a string',
        extractRequestContext(req)
      );
      res.status(400).json({
        error: 'Validation error',
        message: 'Title is required and must be a string',
      });
      return;
    }

    if (title.trim().length === 0) {
      logValidationError(
        'title',
        title,
        'Title cannot be empty',
        extractRequestContext(req)
      );
      res.status(400).json({
        error: 'Validation error',
        message: 'Title cannot be empty',
      });
      return;
    }

    if (title.length > 200) {
      logValidationError(
        'title',
        `length: ${title.length}`,
        'Title too long',
        extractRequestContext(req)
      );
      res.status(400).json({
        error: 'Validation error',
        message: 'Title must be 200 characters or less',
      });
      return;
    }

    // Create document
    const document = await Document.createDocument(
      title.trim(),
      new mongoose.Types.ObjectId(req.user.userId)
    );

    logOperation(
      'create_document',
      document._id.toString(),
      req.user.userId,
      true,
      extractRequestContext(req)
    );

    res.status(201).json({
      id: document._id,
      title: document.title,
      ownerId: document.ownerId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      permissions: document.permissions,
      metadata: document.metadata,
    });
  } catch (error) {
    logError('Create document error', error, {
      ...extractRequestContext(req),
      operationType: 'create_document',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to create document',
    });
  }
};

/**
 * Get document by ID
 * GET /api/documents/:id
 */
export const getDocument = async (
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

    const { id } = req.params;

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document ID',
      });
      return;
    }

    // Find document with permission check
    const document = await Document.findByIdWithPermissions(
      id,
      new mongoose.Types.ObjectId(req.user.userId)
    );

    if (!document) {
      res.status(404).json({
        error: 'Not found',
        message: 'Document not found or access denied',
      });
      return;
    }

    res.status(200).json({
      id: document._id,
      title: document.title,
      ownerId: document.ownerId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      lastSnapshotAt: document.lastSnapshotAt,
      permissions: document.permissions,
      metadata: document.metadata,
    });
  } catch (error) {
    logError('Get document error', error, {
      ...extractRequestContext(req),
      documentId: req.params.id,
      operationType: 'get_document',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to retrieve document',
    });
  }
};

/**
 * List user's documents with pagination
 * GET /api/documents
 */
export const listDocuments = async (
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

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Validate pagination parameters
    if (page < 1) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Page must be greater than 0',
      });
      return;
    }

    if (limit < 1 || limit > 100) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Limit must be between 1 and 100',
      });
      return;
    }

    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    // Find documents where user is owner or has permissions
    const query = {
      isDeleted: false,
      $or: [{ ownerId: userId }, { 'permissions.userId': userId }],
    };

    const [documents, total] = await Promise.all([
      Document.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-snapshotData')
        .lean(),
      Document.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      documents: documents.map((doc) => ({
        id: doc._id,
        title: doc.title,
        ownerId: doc.ownerId,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        lastSnapshotAt: doc.lastSnapshotAt,
        permissions: doc.permissions,
        metadata: doc.metadata,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    logError('List documents error', error, {
      ...extractRequestContext(req),
      operationType: 'list_documents',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to list documents',
    });
  }
};

/**
 * Update document metadata
 * PATCH /api/documents/:id
 */
export const updateDocument = async (
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

    const { id } = req.params;
    const { title } = req.body;

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document ID',
      });
      return;
    }

    // Validate title if provided
    if (title !== undefined) {
      if (typeof title !== 'string') {
        res.status(400).json({
          error: 'Validation error',
          message: 'Title must be a string',
        });
        return;
      }

      if (title.trim().length === 0) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Title cannot be empty',
        });
        return;
      }

      if (title.length > 200) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Title must be 200 characters or less',
        });
        return;
      }
    }

    // Find and update document
    const document = await Document.findByIdAndUpdate(
      id,
      { $set: { title: title.trim() } },
      { new: true, runValidators: true }
    ).select('-snapshotData');

    if (!document) {
      res.status(404).json({
        error: 'Not found',
        message: 'Document not found',
      });
      return;
    }

    logOperation(
      'update_document',
      id,
      req.user.userId,
      true,
      extractRequestContext(req)
    );

    res.status(200).json({
      id: document._id,
      title: document.title,
      ownerId: document.ownerId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      lastSnapshotAt: document.lastSnapshotAt,
      permissions: document.permissions,
      metadata: document.metadata,
    });
  } catch (error) {
    logError('Update document error', error, {
      ...extractRequestContext(req),
      documentId: req.params.id,
      operationType: 'update_document',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update document',
    });
  }
};

/**
 * Soft delete document
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (
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

    const { id } = req.params;

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document ID',
      });
      return;
    }

    // Soft delete document
    const document = await Document.softDelete(id);

    if (!document) {
      res.status(404).json({
        error: 'Not found',
        message: 'Document not found',
      });
      return;
    }

    logOperation(
      'delete_document',
      id,
      req.user.userId,
      true,
      extractRequestContext(req)
    );

    res.status(200).json({
      message: 'Document deleted successfully',
      id: document._id,
    });
  } catch (error) {
    logError('Delete document error', error, {
      ...extractRequestContext(req),
      documentId: req.params.id,
      operationType: 'delete_document',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to delete document',
    });
  }
};

/**
 * Share document with another user
 * POST /api/documents/:id/share
 */
export const shareDocument = async (
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

    const { id } = req.params;
    const { email, role } = req.body;

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document ID',
      });
      return;
    }

    // Validate email
    if (!email || typeof email !== 'string') {
      res.status(400).json({
        error: 'Validation error',
        message: 'Email is required and must be a string',
      });
      return;
    }

    // Validate role
    const validRoles = ['owner', 'editor', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Role must be one of: owner, editor, viewer',
      });
      return;
    }

    // Find the user to share with
    const { User } = await import('../models/User.js');
    const targetUser = await User.findByEmail(email.toLowerCase());

    if (!targetUser) {
      res.status(404).json({
        error: 'Not found',
        message: 'User with this email not found',
      });
      return;
    }

    // Find the document
    const document = await Document.findById(id);

    if (!document) {
      res.status(404).json({
        error: 'Not found',
        message: 'Document not found',
      });
      return;
    }

    if (document.isDeleted) {
      res.status(404).json({
        error: 'Not found',
        message: 'Document has been deleted',
      });
      return;
    }

    // Check if user already has permission
    const targetUserId = targetUser._id as mongoose.Types.ObjectId;
    const existingPermission = document.permissions.find(
      (p) => p.userId.toString() === targetUserId.toString()
    );

    if (existingPermission) {
      // Update existing permission
      existingPermission.role = role;
    } else {
      // Add new permission
      document.permissions.push({
        userId: targetUserId,
        role: role,
      });
    }

    await document.save();

    logOperation(
      'share_document',
      id,
      req.user.userId,
      true,
      {
        ...extractRequestContext(req),
        sharedWithUserId: targetUserId.toString(),
        role,
      }
    );

    res.status(200).json({
      message: 'Document shared successfully',
      documentId: document._id,
      sharedWith: {
        userId: targetUserId,
        email: targetUser.email,
        name: targetUser.name,
        role: role,
      },
    });
  } catch (error) {
    logError('Share document error', error, {
      ...extractRequestContext(req),
      documentId: req.params.id,
      operationType: 'share_document',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to share document',
    });
  }
};

/**
 * Get document version at a specific time
 * GET /api/documents/:id/version
 */
export const getDocumentVersion = async (
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

    const { id } = req.params;
    const { timestamp } = req.query;

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document ID',
      });
      return;
    }

    // Validate timestamp
    if (!timestamp || typeof timestamp !== 'string') {
      res.status(400).json({
        error: 'Validation error',
        message: 'Timestamp is required',
      });
      return;
    }

    const targetTime = new Date(timestamp);
    if (isNaN(targetTime.getTime())) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid timestamp format',
      });
      return;
    }

    // Check document permissions
    const document = await Document.findByIdWithPermissions(
      id,
      new mongoose.Types.ObjectId(req.user.userId)
    );

    if (!document) {
      res.status(404).json({
        error: 'Not found',
        message: 'Document not found or access denied',
      });
      return;
    }

    // Get document state at the specified time
    const { persistenceService } = await import('../services/persistenceService.js');
    const yjsState = await persistenceService.getDocumentAtTime(id, targetTime);

    // Convert Yjs state to base64 for transmission
    const base64State = Buffer.from(yjsState).toString('base64');

    res.status(200).json({
      documentId: id,
      timestamp: targetTime.toISOString(),
      state: base64State,
    });
  } catch (error) {
    logError('Get document version error', error, {
      ...extractRequestContext(req),
      documentId: req.params.id,
      operationType: 'get_document_version',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to retrieve document version',
    });
  }
};

/**
 * Restore document to a previous version
 * POST /api/documents/:id/restore
 */
export const restoreDocumentVersion = async (
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

    const { id } = req.params;
    const { timestamp } = req.body;

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document ID',
      });
      return;
    }

    // Validate timestamp
    if (!timestamp) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Timestamp is required',
      });
      return;
    }

    const targetTime = new Date(timestamp);
    if (isNaN(targetTime.getTime())) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid timestamp format',
      });
      return;
    }

    // Check document permissions (must have write access)
    const document = await Document.findByIdWithPermissions(
      id,
      new mongoose.Types.ObjectId(req.user.userId)
    );

    if (!document) {
      res.status(404).json({
        error: 'Not found',
        message: 'Document not found or access denied',
      });
      return;
    }

    // Get document state at the specified time
    const { persistenceService } = await import('../services/persistenceService.js');
    const yjsState = await persistenceService.getDocumentAtTime(id, targetTime);

    // Update the document snapshot with the restored state
    await persistenceService.saveSnapshot(id, yjsState);

    // Update document metadata
    document.updatedAt = new Date();
    await document.save();

    logger.info('Document version restored', {
      documentId: id,
      userId: req.user.userId,
      restoredTimestamp: targetTime.toISOString(),
    });

    res.status(200).json({
      message: 'Document restored successfully',
      documentId: id,
      restoredTimestamp: targetTime.toISOString(),
    });
  } catch (error) {
    logError('Restore document version error', error, {
      ...extractRequestContext(req),
      documentId: req.params.id,
      operationType: 'restore_document_version',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to restore document version',
    });
  }
};

/**
 * Get document history (operation log)
 * GET /api/documents/:id/history
 */
export const getDocumentHistory = async (
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

    const { id } = req.params;

    // Validate document ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document ID',
      });
      return;
    }

    // Parse pagination parameters
    const pageParam = req.query.page as string;
    const limitParam = req.query.limit as string;
    
    const page = pageParam ? parseInt(pageParam) : 1;
    const limit = limitParam ? parseInt(limitParam) : 50;

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Page must be greater than 0',
      });
      return;
    }

    if (limit < 1 || limit > 100) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Limit must be between 1 and 100',
      });
      return;
    }

    // Parse date range filters
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid startDate format',
      });
      return;
    }

    if (endDate && isNaN(endDate.getTime())) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid endDate format',
      });
      return;
    }

    const skip = (page - 1) * limit;

    // Build query
    const { Operation } = await import('../models/Operation.js');
    const query: any = {
      documentId: new mongoose.Types.ObjectId(id),
    };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = startDate;
      }
      if (endDate) {
        query.timestamp.$lte = endDate;
      }
    }

    // Fetch operations and count
    const [operations, total] = await Promise.all([
      Operation.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .select('-yjsUpdate')
        .lean(),
      Operation.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      operations: operations.map((op) => ({
        id: op._id,
        documentId: op.documentId,
        userId: op.userId,
        timestamp: op.timestamp,
        operationType: op.operationType,
        metadata: op.metadata,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      filters: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
    });
  } catch (error) {
    logError('Get document history error', error, {
      ...extractRequestContext(req),
      documentId: req.params.id,
      operationType: 'get_document_history',
    });
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to retrieve document history',
    });
  }
};
