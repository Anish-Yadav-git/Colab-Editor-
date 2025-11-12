import { useState, useEffect, useRef, useCallback } from 'react';
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
  limit: number;
  hasNextPage: boolean;
  nextCursor?: string;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const observerTarget = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    fetchDocuments();
  }, [token]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination?.hasNextPage && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [pagination, loadingMore]);

  const fetchDocuments = async (cursor?: string) => {
    try {
      const isInitialLoad = !cursor;
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const url = new URL('http://localhost:3000/api/documents');
      url.searchParams.append('limit', '20');
      if (cursor) {
        url.searchParams.append('cursor', cursor);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      
      if (isInitialLoad) {
        setDocuments(data.documents);
      } else {
        setDocuments((prev) => [...prev, ...data.documents]);
      }
      
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (pagination?.nextCursor && !loadingMore) {
      fetchDocuments(pagination.nextCursor);
    }
  }, [pagination?.nextCursor, loadingMore]);

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
    <div className="document-list-container" role="main" aria-label="Document list">
      <div className="document-list-header">
        <h1 id="documents-heading">My Documents</h1>
        <div className="view-controls" role="group" aria-label="View mode controls">
          <button
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            Grid
          </button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            List
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state" role="status">
          <p>No documents found</p>
          <p className="empty-state-hint">Create your first document to get started</p>
        </div>
      ) : (
        <>
          <div 
            className={`documents-${viewMode}`}
            role="list"
            aria-labelledby="documents-heading"
            aria-live="polite"
          >
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="document-card"
                onClick={() => onDocumentSelect?.(doc.id)}
                role="listitem"
                tabIndex={0}
                aria-label={`${doc.title}, ${getUserRole(doc)}, last modified ${formatDate(doc.updatedAt)}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDocumentSelect?.(doc.id);
                  }
                }}
              >
                <div className="document-card-header">
                  <h3 className="document-title">{doc.title}</h3>
                  <span className="document-role" aria-label={`Your role: ${getUserRole(doc)}`}>
                    {getUserRole(doc)}
                  </span>
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

          {/* Infinite scroll trigger */}
          {pagination?.hasNextPage && (
            <div ref={observerTarget} className="load-more-trigger" role="status" aria-live="polite">
              {loadingMore && <div className="loading-more">Loading more documents...</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
};
