import React from 'react';
import './RestoreConfirmDialog.css';

interface RestoreConfirmDialogProps {
  timestamp: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const RestoreConfirmDialog: React.FC<RestoreConfirmDialogProps> = ({
  timestamp,
  onConfirm,
  onCancel,
}) => {
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="restore-confirm-overlay">
      <div className="restore-confirm-dialog">
        <div className="restore-confirm-header">
          <h3>Restore Document Version?</h3>
        </div>
        <div className="restore-confirm-content">
          <p>
            Are you sure you want to restore this document to the version from:
          </p>
          <p className="restore-timestamp">{formatTimestamp(timestamp)}</p>
          <div className="restore-warning">
            <span className="warning-icon">⚠️</span>
            <div className="warning-text">
              <strong>Important:</strong> This will replace the current document
              content with the selected version. The current version will be
              preserved in the history and can be restored later if needed.
            </div>
          </div>
        </div>
        <div className="restore-confirm-actions">
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-button" onClick={onConfirm}>
            Restore Version
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreConfirmDialog;
