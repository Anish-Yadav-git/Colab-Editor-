import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import apiClient from '../services/apiClient';
import RestoreConfirmDialog from './RestoreConfirmDialog';
import './VersionPreview.css';

interface VersionPreviewProps {
  documentId: string;
  timestamp: string;
  currentContent?: string;
  onClose: () => void;
  onRestore?: (timestamp: string) => void;
}

const VersionPreview: React.FC<VersionPreviewProps> = ({
  documentId,
  timestamp,
  currentContent = '',
  onClose,
  onRestore,
}) => {
  const [versionContent, setVersionContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadVersion();
  }, [documentId, timestamp]);

  const loadVersion = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/api/documents/${documentId}/version`,
        {
          params: { timestamp },
        }
      );

      // Response contains base64-encoded Yjs state
      const base64State = response.data.state;
      const binaryState = Uint8Array.from(atob(base64State), (c) =>
        c.charCodeAt(0)
      );

      // Create a temporary Yjs document to extract the text
      const yjsDoc = new Y.Doc();
      Y.applyUpdate(yjsDoc, binaryState);
      const yText = yjsDoc.getText('content');
      const content = yText.toString();

      setVersionContent(content);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to load document version'
      );
      console.error('Error loading version:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmRestore = async () => {
    setShowConfirmDialog(false);
    setRestoring(true);
    setError(null);

    try {
      await apiClient.post(`/api/documents/${documentId}/restore`, {
        timestamp,
      });

      // Call the parent's onRestore callback if provided
      if (onRestore) {
        onRestore(timestamp);
      }

      // Close the preview after successful restore
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to restore document version'
      );
      console.error('Error restoring version:', err);
    } finally {
      setRestoring(false);
    }
  };

  const handleCancelRestore = () => {
    setShowConfirmDialog(false);
  };

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

  const generateDiff = () => {
    if (!currentContent || !versionContent) return [];

    const currentLines = currentContent.split('\n');
    const versionLines = versionContent.split('\n');
    const maxLines = Math.max(currentLines.length, versionLines.length);
    const diff: Array<{
      type: 'same' | 'added' | 'removed' | 'changed';
      version: string;
      current: string;
      lineNum: number;
    }> = [];

    for (let i = 0; i < maxLines; i++) {
      const versionLine = versionLines[i] || '';
      const currentLine = currentLines[i] || '';

      if (versionLine === currentLine) {
        diff.push({
          type: 'same',
          version: versionLine,
          current: currentLine,
          lineNum: i + 1,
        });
      } else if (!currentLine) {
        diff.push({
          type: 'removed',
          version: versionLine,
          current: '',
          lineNum: i + 1,
        });
      } else if (!versionLine) {
        diff.push({
          type: 'added',
          version: '',
          current: currentLine,
          lineNum: i + 1,
        });
      } else {
        diff.push({
          type: 'changed',
          version: versionLine,
          current: currentLine,
          lineNum: i + 1,
        });
      }
    }

    return diff;
  };

  const renderDiffView = () => {
    const diff = generateDiff();

    return (
      <div className="diff-view">
        <div className="diff-column">
          <div className="diff-header">Version at {formatTimestamp(timestamp)}</div>
          <div className="diff-content">
            {diff.map((line, idx) => (
              <div
                key={idx}
                className={`diff-line diff-line-${line.type}`}
                data-line-num={line.lineNum}
              >
                <span className="line-number">{line.lineNum}</span>
                <span className="line-content">{line.version || '\u00A0'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="diff-column">
          <div className="diff-header">Current Version</div>
          <div className="diff-content">
            {diff.map((line, idx) => (
              <div
                key={idx}
                className={`diff-line diff-line-${line.type}`}
                data-line-num={line.lineNum}
              >
                <span className="line-number">{line.lineNum}</span>
                <span className="line-content">{line.current || '\u00A0'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="version-preview-overlay">
      <div className="version-preview-modal">
        <div className="version-preview-header">
          <div className="header-content">
            <h2>Version Preview</h2>
            <p className="version-timestamp">{formatTimestamp(timestamp)}</p>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        <div className="version-preview-toolbar">
          <button
            className={`toolbar-button ${!showDiff ? 'active' : ''}`}
            onClick={() => setShowDiff(false)}
          >
            Preview
          </button>
          <button
            className={`toolbar-button ${showDiff ? 'active' : ''}`}
            onClick={() => setShowDiff(true)}
            disabled={!currentContent}
          >
            Compare with Current
          </button>
          {onRestore && (
            <button
              className="restore-button"
              onClick={handleRestoreClick}
              disabled={loading || restoring}
            >
              {restoring ? 'Restoring...' : 'Restore to This Version'}
            </button>
          )}
        </div>

        {error && <div className="version-preview-error">{error}</div>}

        <div className="version-preview-content">
          {loading ? (
            <div className="version-preview-loading">
              Loading version...
            </div>
          ) : showDiff ? (
            renderDiffView()
          ) : (
            <textarea
              ref={textareaRef}
              className="version-textarea"
              value={versionContent}
              readOnly
              aria-label="Version content"
            />
          )}
        </div>

        <div className="version-preview-footer">
          <div className="footer-info">
            <span className="char-count">
              {versionContent.length} characters
            </span>
            {showDiff && currentContent && (
              <span className="diff-summary">
                {(() => {
                  const diff = generateDiff();
                  const changed = diff.filter((l) => l.type !== 'same').length;
                  return `${changed} line${changed !== 1 ? 's' : ''} changed`;
                })()}
              </span>
            )}
          </div>
        </div>
      </div>

      {showConfirmDialog && (
        <RestoreConfirmDialog
          timestamp={timestamp}
          onConfirm={handleConfirmRestore}
          onCancel={handleCancelRestore}
        />
      )}
    </div>
  );
};

export default VersionPreview;
