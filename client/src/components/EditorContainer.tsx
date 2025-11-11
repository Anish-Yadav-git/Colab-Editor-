import { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Editor, { OnMount } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor';
import { CollaborativeCursor, generateUserColor } from './CollaborativeCursor';
import type { AwarenessState } from './CollaborativeCursor';
import { PresenceIndicator } from './PresenceIndicator';
import './EditorContainer.css';

export type ConnectionState = 'connected' | 'syncing' | 'disconnected';

export interface SyncStatus {
  isSynced: boolean;
  pendingOperations: number;
}

export interface EditorContainerProps {
  documentId: string;
  userId: string;
  userName?: string;
  token: string;
  readOnly?: boolean;
  serverUrl?: string;
  onSyncStatusChange?: (status: SyncStatus) => void;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  documentId,
  userId,
  userName = 'Anonymous',
  token,
  readOnly = false,
  serverUrl = 'ws://localhost:3001',
  onSyncStatusChange,
}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSynced: false,
    pendingOperations: 0,
  });
  const yjsDocRef = useRef<Y.Doc | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const monacoBindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const editorElementRef = useRef<HTMLElement | null>(null);
  const pendingOpsRef = useRef<number>(0);

  useEffect(() => {
    // Initialize Yjs document
    const yjsDoc = new Y.Doc();
    yjsDocRef.current = yjsDoc;

    // Create shared text type
    const yText = yjsDoc.getText('content');
    yTextRef.current = yText;

    // Initialize WebSocket provider
    const provider = new WebsocketProvider(
      serverUrl,
      documentId,
      yjsDoc,
      {
        params: {
          token: token,
          userId: userId,
        },
      }
    );
    providerRef.current = provider;

    // Listen to provider status events
    const handleStatus = (event: { status: string }) => {
      if (event.status === 'connected') {
        setConnectionState('connected');
      } else if (event.status === 'disconnected') {
        setConnectionState('disconnected');
      }
    };

    const handleSync = (isSynced: boolean) => {
      const newSyncStatus: SyncStatus = {
        isSynced,
        pendingOperations: isSynced ? 0 : pendingOpsRef.current,
      };
      setSyncStatus(newSyncStatus);
      
      if (onSyncStatusChange) {
        onSyncStatusChange(newSyncStatus);
      }

      if (isSynced) {
        setConnectionState('connected');
        pendingOpsRef.current = 0;
      } else {
        setConnectionState('syncing');
      }
    };

    // Track local updates to count pending operations
    const handleUpdate = (update: Uint8Array, origin: any) => {
      // Only count updates that originate locally (not from remote)
      if (origin !== provider) {
        pendingOpsRef.current += 1;
        
        // Update sync status to show pending operations
        const newSyncStatus: SyncStatus = {
          isSynced: false,
          pendingOperations: pendingOpsRef.current,
        };
        setSyncStatus(newSyncStatus);
        
        if (onSyncStatusChange) {
          onSyncStatusChange(newSyncStatus);
        }
        
        // Show syncing state when there are pending operations
        if (pendingOpsRef.current > 0) {
          setConnectionState('syncing');
        }
      }
    };

    yjsDoc.on('update', handleUpdate);
    provider.on('status', handleStatus);
    provider.on('sync', handleSync);

    // Set initial connection state
    setConnectionState('disconnected');

    // Cleanup on unmount
    return () => {
      // Remove event listeners
      if (yjsDocRef.current) {
        yjsDocRef.current.off('update', handleUpdate);
      }

      if (providerRef.current) {
        providerRef.current.off('status', handleStatus);
        providerRef.current.off('sync', handleSync);
        providerRef.current.destroy();
        providerRef.current = null;
      }

      // Clean up Monaco binding
      if (monacoBindingRef.current) {
        monacoBindingRef.current.destroy();
        monacoBindingRef.current = null;
      }

      // Clean up Yjs document
      if (yjsDocRef.current) {
        yjsDocRef.current.destroy();
        yjsDocRef.current = null;
        yTextRef.current = null;
      }

      editorRef.current = null;
    };
  }, [documentId, userId, token, serverUrl, onSyncStatusChange]);

  const handleEditorDidMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;
    editorElementRef.current = editor.getDomNode();

    // Bind Yjs text to Monaco model
    if (yTextRef.current && yjsDocRef.current && providerRef.current) {
      const model = editor.getModel();
      if (model) {
        // Track cursor position before remote changes
        let lastCursorPosition = editor.getPosition();
        let lastContentLength = model.getValueLength();

        // Listen to model content changes to detect remote updates
        model.onDidChangeContent((e) => {
          // Check if this is a remote change (not from local typing)
          const currentPosition = editor.getPosition();
          const newContentLength = model.getValueLength();
          
          // If content changed but cursor didn't move, it's likely a remote change
          if (currentPosition && lastCursorPosition) {
            const contentDelta = newContentLength - lastContentLength;
            
            // If content was inserted before cursor, adjust cursor position
            if (contentDelta !== 0 && e.changes.length > 0) {
              for (const change of e.changes) {
                const changeEndLine = change.range.endLineNumber;
                const changeEndColumn = change.range.endColumn;
                
                // If change occurred before or at cursor position
                if (
                  changeEndLine < currentPosition.lineNumber ||
                  (changeEndLine === currentPosition.lineNumber && 
                   changeEndColumn <= currentPosition.column)
                ) {
                  // Monaco binding handles this automatically via Yjs CRDT
                  // The cursor position is preserved relative to content
                  // No manual adjustment needed - just track for monitoring
                }
              }
            }
          }
          
          lastCursorPosition = editor.getPosition();
          lastContentLength = newContentLength;
        });

        monacoBindingRef.current = new MonacoBinding(
          yTextRef.current,
          model,
          new Set([editor]),
          providerRef.current.awareness
        );
      }

      // Set initial awareness state
      const userColor = generateUserColor(userId);
      providerRef.current.awareness.setLocalStateField('user', {
        id: userId,
        name: userName,
        color: userColor,
      });

      // Throttle awareness updates to 10 per second (100ms interval)
      let lastCursorUpdate = 0;
      let pendingCursorUpdate: { line: number; column: number } | null = null;
      let cursorUpdateTimer: number | null = null;

      const throttledCursorUpdate = () => {
        if (pendingCursorUpdate && providerRef.current) {
          providerRef.current.awareness.setLocalStateField('cursor', pendingCursorUpdate);
          pendingCursorUpdate = null;
          lastCursorUpdate = Date.now();
        }
        cursorUpdateTimer = null;
      };

      // Track cursor position changes with throttling
      editor.onDidChangeCursorPosition((e) => {
        if (providerRef.current) {
          const position = e.position;
          const now = Date.now();
          const timeSinceLastUpdate = now - lastCursorUpdate;

          pendingCursorUpdate = {
            line: position.lineNumber,
            column: position.column,
          };

          // If enough time has passed, update immediately
          if (timeSinceLastUpdate >= 100) {
            throttledCursorUpdate();
          } else if (!cursorUpdateTimer) {
            // Otherwise, schedule an update
            cursorUpdateTimer = window.setTimeout(
              throttledCursorUpdate,
              100 - timeSinceLastUpdate
            );
          }
        }
      });

      // Track selection changes with throttling
      let lastSelectionUpdate = 0;
      let pendingSelectionUpdate: { start: { line: number; column: number }; end: { line: number; column: number } } | null = null;
      let selectionUpdateTimer: number | null = null;

      const throttledSelectionUpdate = () => {
        if (providerRef.current) {
          providerRef.current.awareness.setLocalStateField('selection', pendingSelectionUpdate);
          pendingSelectionUpdate = null;
          lastSelectionUpdate = Date.now();
        }
        selectionUpdateTimer = null;
      };

      editor.onDidChangeCursorSelection((e) => {
        if (providerRef.current) {
          const selection = e.selection;
          const now = Date.now();
          const timeSinceLastUpdate = now - lastSelectionUpdate;

          if (selection.isEmpty()) {
            pendingSelectionUpdate = null;
            if (timeSinceLastUpdate >= 100) {
              throttledSelectionUpdate();
            } else if (!selectionUpdateTimer) {
              selectionUpdateTimer = window.setTimeout(
                throttledSelectionUpdate,
                100 - timeSinceLastUpdate
              );
            }
          } else {
            pendingSelectionUpdate = {
              start: {
                line: selection.startLineNumber,
                column: selection.startColumn,
              },
              end: {
                line: selection.endLineNumber,
                column: selection.endColumn,
              },
            };

            if (timeSinceLastUpdate >= 100) {
              throttledSelectionUpdate();
            } else if (!selectionUpdateTimer) {
              selectionUpdateTimer = window.setTimeout(
                throttledSelectionUpdate,
                100 - timeSinceLastUpdate
              );
            }
          }
        }
      });
    }
  };

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="connection-indicator">
          <span className={`status-dot status-${connectionState}`}></span>
          <span className="status-text">
            {connectionState === 'connected' && syncStatus.isSynced && 'Connected'}
            {connectionState === 'syncing' && (
              <>
                Syncing...
                {syncStatus.pendingOperations > 0 && (
                  <span className="pending-ops"> ({syncStatus.pendingOperations} pending)</span>
                )}
              </>
            )}
            {connectionState === 'disconnected' && 'Disconnected'}
          </span>
        </div>
        <PresenceIndicator awareness={providerRef.current?.awareness || null} />
      </div>
      <div className="editor-content">
        <Editor
          height="100%"
          defaultLanguage="plaintext"
          defaultValue=""
          onMount={handleEditorDidMount}
          options={{
            readOnly: readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
        <CollaborativeCursor
          awareness={providerRef.current?.awareness || null}
          editorElement={editorElementRef.current}
        />
      </div>
    </div>
  );
};
