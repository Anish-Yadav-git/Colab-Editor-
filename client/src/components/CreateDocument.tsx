import { useState, FormEvent } from 'react';
import './CreateDocument.css';

interface CreateDocumentProps {
  token: string;
  onDocumentCreated?: (documentId: string) => void;
  onCancel?: () => void;
}

interface ValidationError {
  field: string;
  message: string;
}

export const CreateDocument: React.FC<CreateDocumentProps> = ({
  token,
  onDocumentCreated,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const validateTitle = (value: string): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!value.trim()) {
      errors.push({
        field: 'title',
        message: 'Title is required',
      });
    } else if (value.length > 200) {
      errors.push({
        field: 'title',
        message: 'Title must be 200 characters or less',
      });
    }

    return errors;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const errors = validateTitle(title);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 && data.message) {
          setValidationErrors([
            {
              field: 'title',
              message: data.message,
            },
          ]);
        } else {
          throw new Error(data.message || 'Failed to create document');
        }
        return;
      }

      // Success - navigate to editor
      if (onDocumentCreated) {
        onDocumentCreated(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const getTitleError = () => {
    return validationErrors.find((e) => e.field === 'title')?.message;
  };

  return (
    <div className="create-document-container">
      <div className="create-document-modal">
        <h2>Create New Document</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="document-title">
              Document Title <span className="required">*</span>
            </label>
            <input
              id="document-title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter document title"
              disabled={loading}
              className={getTitleError() ? 'error' : ''}
              maxLength={201}
              autoFocus
            />
            {getTitleError() && (
              <span className="error-message">{getTitleError()}</span>
            )}
            <span className="character-count">
              {title.length} / 200 characters
            </span>
          </div>

          {error && (
            <div className="error-banner">
              <p>{error}</p>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="btn-primary"
            >
              {loading ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
