# EditorContainer Component

The `EditorContainer` component is the foundation for the real-time collaborative editor. It integrates Yjs CRDT, Monaco Editor, and WebSocket connectivity.

## Features

- **Yjs CRDT Integration**: Automatic conflict-free document synchronization
- **Monaco Editor**: Full-featured code/text editor with syntax highlighting
- **WebSocket Provider**: Real-time bidirectional communication with the server
- **Connection State Management**: Visual indicators for connected, syncing, and disconnected states
- **Awareness Protocol**: Support for shared cursors and presence (via y-monaco binding)

## Usage

```tsx
import { EditorContainer } from './components/EditorContainer';

function MyEditor() {
  return (
    <EditorContainer
      documentId="doc-123"
      userId="user-456"
      token="jwt-token"
      serverUrl="ws://localhost:3001"
      readOnly={false}
    />
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `documentId` | `string` | Yes | - | Unique identifier for the document |
| `userId` | `string` | Yes | - | Current user's ID |
| `token` | `string` | Yes | - | JWT authentication token |
| `readOnly` | `boolean` | No | `false` | Whether the editor is read-only |
| `serverUrl` | `string` | No | `'ws://localhost:3001'` | WebSocket server URL |

## Connection States

The component displays three connection states:

- **Connected** (green): Successfully connected and synced with the server
- **Syncing** (orange): Connected but still synchronizing document state
- **Disconnected** (red): Not connected to the server

## Architecture

### Component Structure

```
EditorContainer
├── Yjs Document (Y.Doc)
│   └── Shared Text (yText)
├── WebSocket Provider
│   ├── Connection Management
│   └── Awareness Protocol
└── Monaco Editor
    └── MonacoBinding (Yjs ↔ Monaco)
```

### Lifecycle

1. **Mount**: Initialize Yjs document, create shared text type, establish WebSocket connection
2. **Editor Mount**: Bind Yjs text to Monaco editor model
3. **Updates**: Yjs automatically syncs changes bidirectionally
4. **Unmount**: Clean up Monaco binding, WebSocket provider, and Yjs document

## Testing

The component includes comprehensive tests covering:

- Component initialization
- Yjs document creation
- Monaco editor binding
- Connection state management
- Resource cleanup
- Props handling

Run tests with:

```bash
npm test
```

## Implementation Details

### Yjs Document

The component creates a Yjs document with a shared text type named 'content':

```typescript
const yjsDoc = new Y.Doc();
const yText = yjsDoc.getText('content');
```

### WebSocket Provider

The WebSocket provider handles:
- Connection to the server
- Authentication via JWT token
- Automatic reconnection
- State synchronization

### Monaco Binding

The MonacoBinding connects the Yjs text to the Monaco editor model, enabling:
- Local-first editing (immediate UI updates)
- Automatic conflict resolution
- Cursor and selection synchronization (via awareness)

## Next Steps

This component provides the foundation for:
- Shared cursor visualization (Task 12)
- Offline support (Task 14)
- Document management UI (Task 15)
- Authentication UI (Task 16)

## Requirements Satisfied

- **Requirement 1.1**: Real-time WebSocket connection
- **Requirement 2.1**: CRDT-based conflict resolution (Yjs)
- **Requirement 4.1**: Optimistic UI with local-first editing
- **Requirement 4.4**: Responsive editing experience
