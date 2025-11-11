import express from 'express';
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  shareDocument,
  getDocumentHistory,
  getDocumentVersion,
  restoreDocumentVersion,
} from '../controllers/documentController.js';
import { verifyToken, checkDocumentPermission } from '../middleware/auth.js';
import { documentCreationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * POST /api/documents
 * Create a new document
 * Requires authentication
 * Rate limited to 10 documents per hour per user
 */
router.post('/', verifyToken, documentCreationLimiter, createDocument);

/**
 * GET /api/documents
 * List user's documents with pagination
 * Requires authentication
 */
router.get('/', verifyToken, listDocuments);

/**
 * GET /api/documents/:id
 * Get document by ID
 * Requires authentication and read permission
 */
router.get('/:id', verifyToken, checkDocumentPermission('read'), getDocument);

/**
 * PATCH /api/documents/:id
 * Update document metadata (title)
 * Requires authentication and write permission
 */
router.patch(
  '/:id',
  verifyToken,
  checkDocumentPermission('write'),
  updateDocument
);

/**
 * DELETE /api/documents/:id
 * Soft delete document
 * Requires authentication and admin permission (owner only)
 */
router.delete(
  '/:id',
  verifyToken,
  checkDocumentPermission('admin'),
  deleteDocument
);

/**
 * POST /api/documents/:id/share
 * Share document with another user
 * Requires authentication and admin permission (owner only)
 */
router.post(
  '/:id/share',
  verifyToken,
  checkDocumentPermission('admin'),
  shareDocument
);

/**
 * GET /api/documents/:id/history
 * Get document operation history
 * Requires authentication and read permission
 */
router.get(
  '/:id/history',
  verifyToken,
  checkDocumentPermission('read'),
  getDocumentHistory
);

/**
 * GET /api/documents/:id/version
 * Get document state at a specific point in time
 * Requires authentication and read permission
 * Query params: timestamp (ISO 8601 date string)
 */
router.get(
  '/:id/version',
  verifyToken,
  checkDocumentPermission('read'),
  getDocumentVersion
);

/**
 * POST /api/documents/:id/restore
 * Restore document to a previous version
 * Requires authentication and write permission
 * Body: { timestamp: ISO 8601 date string }
 */
router.post(
  '/:id/restore',
  verifyToken,
  checkDocumentPermission('write'),
  restoreDocumentVersion
);

export default router;
