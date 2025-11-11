import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import VersionPreview from './VersionPreview';
import './DocumentHistory.css';

interface Operation {
  id: string;
  documentId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  timestamp: string;
  operationType: 'insert' | 'delete' | 'format';
  metadata: {
    clientId: string;
    sessionId: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface DocumentHistoryProps {
  documentId: string;
  currentContent?: string;
  onVersionSelect?: (timestamp: string) => void;
  onRestore?: (timestamp: string) => void;
  onClose?: () => void;
}

const DocumentHistory: React.FC<DocumentHistoryProps> = ({
  documentId,
  currentContent,
  onVersionSelect,
  onRestore,
  onClose,
}) => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);

  const fetchHistory = async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page,
        limit: 50,
      };

      if (startDate) {
        params.startDate = new Date(startDate).toISOString();
      }

      if (endDate) {
        params.endDate = new Date(endDate).toISOString();
      }

      const response = await apiClient.get(
        `/api/documents/${documentId}/history`,
        { params }
      );

      setOperations(response.data.operations);
      setPagination(response.data.pagination);
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load document history');
      console.error('Error fetching document history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, [documentId]);

  const handleApplyFilters = () => {
    fetchHistory(1);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    // Fetch without filters
    setTimeout(() => fetchHistory(1), 0);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && pagination && newPage <= pagination.totalPages) {
      fetchHistory(newPage);
    }
  };

  const handleVersionClick = (timestamp: string) => {
    setSelectedTimestamp(timestamp);
    if (onVersionSelect) {
      onVersionSelect(timestamp);
    }
  };

  const handleClosePreview = () => {
    setSelectedTimestamp(null);
  };

  const handleRestoreVersion = (timestamp: string) => {
    if (onRestore) {
      onRestore(timestamp);
    }
    setSelectedTimestamp(null);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'insert':
        return '✏️';
      case 'delete':
        return '🗑️';
      case 'format':
        return '🎨';
      default:
        return '📝';
    }
  };

  return (
    <>
      <div className="document-history">
        <div className="document-history-header">
          <h2>Document History</h2>
          {onClose && (
            <button className="close-button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

      <div className="history-filters">
        <div className="filter-group">
          <label htmlFor="start-date">Start Date:</label>
          <input
            id="start-date"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="end-date">End Date:</label>
          <input
            id="end-date"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="filter-actions">
          <button onClick={handleApplyFilters} className="apply-filters-button">
            Apply Filters
          </button>
          <button onClick={handleClearFilters} className="clear-filters-button">
            Clear
          </button>
        </div>
      </div>

      {error && <div className="history-error">{error}</div>}

      {loading ? (
        <div className="history-loading">Loading history...</div>
      ) : (
        <>
          <div className="history-timeline">
            {operations.length === 0 ? (
              <div className="no-operations">No operations found</div>
            ) : (
              operations.map((operation) => (
                <div
                  key={operation.id}
                  className="timeline-item"
                  onClick={() => handleVersionClick(operation.timestamp)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleVersionClick(operation.timestamp);
                    }
                  }}
                >
                  <div className="timeline-marker">
                    <span className="operation-icon">
                      {getOperationIcon(operation.operationType)}
                    </span>
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="user-name">{operation.userId.name}</span>
                      <span className="operation-type">{operation.operationType}</span>
                    </div>
                    <div className="timeline-timestamp">
                      {formatTimestamp(operation.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="history-pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                className="pagination-button"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total}{' '}
                operations)
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      </div>

      {selectedTimestamp && (
        <VersionPreview
          documentId={documentId}
          timestamp={selectedTimestamp}
          currentContent={currentContent}
          onClose={handleClosePreview}
          onRestore={onRestore ? handleRestoreVersion : undefined}
        />
      )}
    </>
  );
};

export default DocumentHistory;
