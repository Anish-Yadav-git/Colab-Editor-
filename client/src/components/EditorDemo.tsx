import { EditorContainer } from './EditorContainer';

/**
 * Demo component to showcase the collaborative editor with cursor visualization
 * This can be used for manual testing and demonstration purposes
 */
export const EditorDemo: React.FC = () => {
  // Example usage with mock data
  const documentId = 'demo-document-123';
  const userId = 'user-' + Math.random().toString(36).substr(2, 9);
  const userName = 'Demo User';
  const token = 'demo-jwt-token';
  const serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Real-Time Collaborative Editor</h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.875rem' }}>
          Document: {documentId} | User: {userName} ({userId})
        </p>
      </div>
      <div style={{ flex: 1 }}>
        <EditorContainer
          documentId={documentId}
          userId={userId}
          userName={userName}
          token={token}
          serverUrl={serverUrl}
        />
      </div>
    </div>
  );
};
