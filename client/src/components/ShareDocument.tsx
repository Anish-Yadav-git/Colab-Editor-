import { useState, useEffect, FormEvent } from 'react';
import './ShareDocument.css';

interface Permission {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
}

interface Collaborator {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
}

interface ShareDocumentProps {
  documentId: string;
  token: string;
  onClose: () => void;
  onShared?: () => void;
}

export const ShareDocument: React.FC<ShareDocumentProps> = ({
  documentId,
  token,
  onClose,
  onShared,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      
      // Convert permissions to collaborators format
      // In a real app, we'd fetch user details for each permission
      const collabs: Collaborator[] = data.permissions.map((p: Permission) => ({
        userId: p.userId,
        email: p.userId === data.ownerId ? 'owner@example.com' : 'user@example.com',
        name: p.userId === data.ownerId ? 'Owner' : 'User',
        role: p.role,
      }));
      
      setCollaborators(collabs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (value: string): string | null => {
    if (!value.trim()) {
      return 'Email is required';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const error = validateEmail(email);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setSharing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `http://localhost:3000/api/documents/${documentId}/share`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: email.toLowerCase().trim(),
            role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 && data.message) {
          setValidationError(data.message);
        } else if (response.status === 404 && data.message) {
          setValidationError(data.message);
        } else {
          throw new Error(data.message || 'Failed to share document');
        }
        return;
      }

      // Success
      setSuccessMessage(`Document shared with ${data.sharedWith.email}`);
      setEmail('');
      setRole('editor');
      
      // Refresh collaborators list
      await fetchDocument();
      
      if (onShared) {
        onShared();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="share-document-container">
      <div className="share-document-modal">
        <div className="modal-header">
          <h2>Share Document</h2>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-banner">
              <p>{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="success-banner">
              <p>{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group flex-grow">
                <label htmlFor="user-email">User Email</label>
                <input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setValidationError(null);
                    setSuccessMessage(null);
                  }}
                  placeholder="user@example.com"
                  disabled={sharing}
                  className={validationError ? 'error' : ''}
                />
                {validationError && (
                  <span className="error-message">{validationError}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="user-role">Role</label>
                <select
                  id="user-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                  disabled={sharing}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={sharing || !email.trim()}
              className="btn-primary"
            >
              {sharing ? 'Sharing...' : 'Share'}
            </button>
          </form>

          <div className="collaborators-section">
            <h3>Current Collaborators</h3>
            {loading ? (
              <div className="loading">Loading...</div>
            ) : collaborators.length === 0 ? (
              <p className="empty-state">No collaborators yet</p>
            ) : (
              <div className="collaborators-list">
                {collaborators.map((collab, index) => (
                  <div key={index} className="collaborator-item">
                    <div className="collaborator-info">
                      <div className="collaborator-name">{collab.name}</div>
                      <div className="collaborator-email">{collab.email}</div>
                    </div>
                    <span className={`collaborator-role role-${collab.role}`}>
                      {collab.role.charAt(0).toUpperCase() +
                        collab.role.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
