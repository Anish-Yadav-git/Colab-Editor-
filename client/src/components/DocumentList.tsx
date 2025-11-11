import { useState, useEffect } from 'react';
import './DocumentList.css';

interface Document {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  lastSnapshotAt?: string;
  permissions: Array<{
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
  }>;
  metadata: {
    characterCount: number;
    operationCount: number;
    activeUsers: number;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface DocumentListProps {
  token: string;
  userId: string;
  onDocumentSelect?: (documentId: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  token,
  userId,
  onDocumentSelect,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchDocuments(currentPage);
  }, [currentPage, token]);

  const fetchDocuments = async (page: number) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:3000/api/documents?page=${page}&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const getUserRole = (doc: Document): string => {
    if (doc.ownerId === userId) return 'Owner';
    const permission = doc.permissions.find((p) => p.userId === userId);
    return permission ? permission.role.charAt(0).toUpperCase() + permission.role.slice(1) : 'Viewer';
  };

  if (loading && documents.length === 0) {
    return (
      <div className="document-list-container">
        <div className="loading">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-list-container">
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={() => fetchDocuments(currentPage)}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="document-list-container">
      <div className="document-list-header">
        <h1>My Documents</h1>
        <div className="view-controls">
          <button
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            Grid
          </button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            List
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <p>No documents found</p>
          <p className="empty-state-hint">Create your first document to get started</p>
        </div>
      ) : (
        <>
          <div className={`documents-${viewMode}`}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="document-card"
                onClick={() => onDocumentSelect?.(doc.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDocumentSelect?.(doc.id);
                  }
                }}
              >
                <div className="document-card-header">
                  <h3 className="document-title">{doc.title}</h3>
                  <span className="document-role">{getUserRole(doc)}</span>
                </div>
                <div className="document-card-body">
                  <div className="document-meta">
                    <span className="document-meta-item">
                      Last modified: {formatDate(doc.updatedAt)}
                    </span>
                    <span className="document-meta-item">
                      {doc.metadata.characterCount} characters
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPrevPage || loading}
                aria-label="Previous page"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNextPage || loading}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
