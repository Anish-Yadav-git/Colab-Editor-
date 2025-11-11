import { useState, useEffect, FormEvent } from 'react';
import './DocumentSettings.css';

interface Permission {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
}

interface Document {
  id: string;
  title: string;
  ownerId: string;
  permissions: Permission[];
}

interface DocumentSettingsProps {
  documentId: string;
  token: string;
  userId: string;
  onClose: () => void;
  onDocumentUpdated?: () => void;
  onDocumentDeleted?: () => void;
}

export const DocumentSettings: React.FC<DocumentSettingsProps> = ({
  documentId,
  token,
  userId,
  onClose,
  onDocumentUpdated,
  onDocumentDeleted,
}) => {
  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocument();
  }, [documentId, token]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:3000/api/documents/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const data = await response.json();
      setDocument(data);
      setTitle(data.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const validateTitle = (value: string): string | null => {
    if (!value.trim()) {
      return 'Title is required';
    }
    if (value.length > 200) {
      return 'Title must be 200 characters or less';
    }
    return null;
  };

  const handleSaveTitle = async (e: FormEvent) => {
    e.preventDefault();

    const error = validateTitle(title);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:3000/api/documents/${documentId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: title.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 && data.message) {
          setValidationError(data.message);
        } else {
          throw new Error(data.message || 'Failed to update document');
        }
        return;
      }

      setDocument(data);
      if (onDocumentUpdated) {
        onDocumentUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:3000/api/documents/${documentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete document');
      }

      if (onDocumentDeleted) {
        onDocumentDeleted();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const isOwner = document?.ownerId === userId;

  if (loading) {
    return (
      <div className="document-settings-container">
        <div className="document-settings-modal">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="document-settings-container">
        <div className="document-settings-modal">
          <div className="error">Failed to load document</div>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="document-settings-container">
      <div className="document-settings-modal">
        <div className="modal-header">
          <h2>Document Settings</h2>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <p>{error}</p>
          </div>
        )}

        <div className="modal-body">
          <form onSubmit={handleSaveTitle}>
            <div className="form-group">
              <label htmlFor="document-title">Document Title</label>
              <input
                id="document-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setValidationError(null);
                }}
                disabled={saving || !isOwner}
                className={validationError ? 'error' : ''}
                maxLength={201}
              />
              {validationError && (
                <span className="error-message">{validationError}</span>
              )}
              <span className="character-count">
                {title.length} / 200 characters
              </span>
            </div>

            {isOwner && (
              <button
                type="submit"
                disabled={saving || title === document.title}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </form>

          <div className="permissions-section">
            <h3>Permissions</h3>
            <div className="permissions-list">
              {document.permissions.map((permission, index) => (
                <div key={index} className="permission-item">
                  <span className="permission-user">
                    {permission.userId === document.ownerId
                      ? 'You (Owner)'
                      : permission.userId}
                  </span>
                  <span className={`permission-role role-${permission.role}`}>
                    {permission.role.charAt(0).toUpperCase() +
                      permission.role.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isOwner && (
            <div className="danger-zone">
              <h3>Danger Zone</h3>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger"
                  disabled={deleting}
                >
                  Delete Document
                </button>
              ) : (
                <div className="delete-confirm">
                  <p>
                    Are you sure you want to delete this document? This action
                    cannot be undone.
                  </p>
                  <div className="delete-actions">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn-secondary"
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="btn-danger"
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
