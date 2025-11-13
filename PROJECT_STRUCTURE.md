# 📁 Project Structure

Complete directory structure and organization of the Realtime Collaborative Document Editor.

## 🌳 Directory Tree

```
realtime-collaborative-editor/
├── 📄 README.md                    # Main project documentation
├── 📄 QUICKSTART.md                # Quick start guide
├── 📄 PROJECT_STRUCTURE.md         # This file
├── 📄 package.json                 # Root package configuration
├── 📄 docker-compose.yml           # Docker services configuration
├── 📄 .gitignore                   # Git ignore rules
│
├── 📁 client/                      # Frontend React application
│   ├── 📁 src/
│   │   ├── 📁 components/          # React components
│   │   │   ├── ActivityIndicator.tsx
│   │   │   ├── CollaborativeCursor.tsx
│   │   │   ├── CreateDocument.tsx
│   │   │   ├── DocumentHistory.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── DocumentSettings.tsx
│   │   │   ├── EditorContainer.tsx  # Main editor component
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── FormInput.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── OfflineIndicator.tsx
│   │   │   ├── PresenceIndicator.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── RestoreConfirmDialog.tsx
│   │   │   ├── ShareDocument.tsx
│   │   │   ├── VersionPreview.tsx
│   │   │   ├── WebSocketErrorNotification.tsx
│   │   │   └── *.css               # Component styles
│   │   │
│   │   ├── 📁 contexts/            # React contexts
│   │   │   └── AuthContext.tsx     # Authentication context
│   │   │
│   │   ├── 📁 hooks/               # Custom React hooks
│   │   │   ├── useOfflineDetection.ts
│   │   │   ├── useOfflineSync.ts
│   │   │   └── useWebSocketError.ts
│   │   │
│   │   ├── 📁 services/            # API and service layer
│   │   │   ├── apiClient.ts        # HTTP client
│   │   │   └── OfflineQueue.ts     # Offline operation queue
│   │   │
│   │   ├── 📁 utils/               # Utility functions
│   │   │   └── validation.ts       # Input validation
│   │   │
│   │   ├── App.tsx                 # Main app component
│   │   ├── main.tsx                # App entry point
│   │   └── index.css               # Global styles
│   │
│   ├── 📁 e2e/                     # End-to-end tests
│   │   ├── collaboration.spec.ts
│   │   ├── offline-sync.spec.ts
│   │   ├── permissions.spec.ts
│   │   └── user-workflow.spec.ts
│   │
│   ├── 📄 index.html               # HTML template
│   ├── 📄 vite.config.ts           # Vite configuration
│   ├── 📄 playwright.config.ts     # Playwright configuration
│   ├── 📄 tsconfig.json            # TypeScript configuration
│   ├── 📄 package.json             # Client dependencies
│   └── 📄 Dockerfile               # Client Docker image
│
├── 📁 server/                      # Backend Node.js application
│   ├── 📁 src/
│   │   ├── 📁 config/              # Configuration files
│   │   │   ├── database.ts         # Database connection
│   │   │   ├── redis.ts            # Redis connection
│   │   │   └── logger.ts           # Logger configuration
│   │   │
│   │   ├── 📁 models/              # Database models
│   │   │   ├── User.ts             # User model
│   │   │   ├── Document.ts         # Document model
│   │   │   ├── Operation.ts        # Operation model
│   │   │   └── index.ts            # Model exports
│   │   │
│   │   ├── 📁 controllers/         # Request handlers
│   │   │   ├── authController.ts   # Authentication
│   │   │   ├── documentController.ts # Document CRUD
│   │   │   └── healthController.ts # Health checks
│   │   │
│   │   ├── 📁 services/            # Business logic
│   │   │   ├── authService.ts      # Auth logic
│   │   │   ├── documentCacheService.ts
│   │   │   ├── metricsService.ts   # Metrics collection
│   │   │   └── persistenceService.ts
│   │   │
│   │   ├── 📁 middleware/          # Express middleware
│   │   │   ├── auth.ts             # JWT authentication
│   │   │   ├── errorHandler.ts     # Error handling
│   │   │   ├── inputSanitization.ts # XSS protection
│   │   │   ├── metricsMiddleware.ts
│   │   │   └── rateLimiter.ts      # Rate limiting
│   │   │
│   │   ├── 📁 routes/              # API routes
│   │   │   ├── auth.ts             # Auth routes
│   │   │   └── documents.ts        # Document routes
│   │   │
│   │   ├── 📁 websocket/           # WebSocket server
│   │   │   ├── WebSocketServer.ts  # WS server
│   │   │   ├── Room.ts             # Document room
│   │   │   ├── RoomManager.ts      # Room management
│   │   │   ├── YjsSyncProtocol.ts  # Yjs sync
│   │   │   ├── OperationDeduplicator.ts
│   │   │   └── WebSocketRateLimiter.ts
│   │   │
│   │   ├── 📁 utils/               # Utility functions
│   │   │   └── errorLogger.ts      # Error logging
│   │   │
│   │   ├── 📁 tests/               # Test files
│   │   │   ├── 📁 controllers/     # Controller tests
│   │   │   ├── 📁 services/        # Service tests
│   │   │   ├── 📁 middleware/      # Middleware tests
│   │   │   ├── 📁 models/          # Model tests
│   │   │   ├── 📁 websocket/       # WebSocket tests
│   │   │   ├── 📁 integration/     # Integration tests
│   │   │   ├── 📁 security/        # Security tests
│   │   │   ├── 📁 performance/     # Performance tests
│   │   │   ├── 📁 crdt/            # CRDT tests
│   │   │   ├── 📁 simulation/      # Simulation tests
│   │   │   ├── 📁 fault/           # Fault injection tests
│   │   │   ├── 📁 load/            # Load tests
│   │   │   └── 📁 redis/           # Redis tests
│   │   │
│   │   └── index.ts                # Server entry point
│   │
│   ├── 📄 package.json             # Server dependencies
│   ├── 📄 tsconfig.json            # TypeScript configuration
│   ├── 📄 Dockerfile               # Server Docker image
│   └── 📄 .env.example             # Environment template
│
├── 📁 docs/                        # Documentation
│   ├── 📄 INDEX.md                 # Documentation index
│   │
│   ├── 📁 api/                     # API documentation
│   │   ├── API.md                  # REST API reference
│   │   ├── WEBSOCKET.md            # WebSocket protocol
│   │   ├── AUTHENTICATION.md       # Auth documentation
│   │   ├── AUTH_ENDPOINTS.md       # Auth endpoints
│   │   └── postman_collection.json # Postman collection
│   │
│   ├── 📁 development/             # Development docs
│   │   ├── SETUP_VERIFICATION.md
│   │   ├── TASK_*_VERIFICATION.md  # Task completions (25 files)
│   │   ├── TASK_*_SUMMARY.md       # Task summaries
│   │   ├── IMPLEMENTATION_SUMMARY.md
│   │   ├── OFFLINE_SUPPORT_SUMMARY.md
│   │   ├── TASK_25_E2E_TESTING.md
│   │   └── TASK_25_PERFORMANCE_OPTIMIZATION.md
│   │
│   ├── 📁 testing/                 # Testing documentation
│   │   └── (Test guides and results)
│   │
│   └── 📁 architecture/            # Architecture docs
│       └── (System design documents)
│
└── 📁 .kiro/                       # Kiro IDE configuration
    └── 📁 specs/
        └── 📁 realtime-collaborative-editor/
            ├── requirements.md
            ├── design.md
            └── tasks.md
```

## 📦 Key Directories Explained

### `/client` - Frontend Application

**Purpose**: React-based single-page application for the user interface.

**Key Files**:
- `src/App.tsx` - Main application component with routing
- `src/components/EditorContainer.tsx` - Core collaborative editor
- `src/contexts/AuthContext.tsx` - Authentication state management
- `vite.config.ts` - Build configuration with optimization

**Technologies**:
- React 18 with TypeScript
- Monaco Editor for code editing
- Yjs for CRDT synchronization
- Vite for fast builds

### `/server` - Backend Application

**Purpose**: Node.js/Express server handling API requests and WebSocket connections.

**Key Files**:
- `src/index.ts` - HTTP server entry point
- `src/websocket/WebSocketServer.ts` - Real-time communication
- `src/controllers/` - Request handlers
- `src/models/` - Database models

**Technologies**:
- Node.js with Express
- TypeScript
- PostgreSQL for persistence
- Redis for session management
- WebSocket for real-time sync

### `/docs` - Documentation

**Purpose**: Comprehensive project documentation organized by category.

**Structure**:
- `api/` - API and protocol documentation
- `development/` - Development and task completion docs
- `testing/` - Test documentation and results
- `architecture/` - System design documents

### Root Files

- **README.md** - Main project overview and features
- **QUICKSTART.md** - Quick setup guide (5 minutes)
- **PROJECT_STRUCTURE.md** - This file
- **docker-compose.yml** - Multi-container Docker setup
- **package.json** - Root workspace configuration

## 🎯 File Naming Conventions

### Components
```
ComponentName.tsx       # Component implementation
ComponentName.css       # Component styles
ComponentName.test.tsx  # Component tests
```

### Services
```
serviceName.ts          # Service implementation
serviceName.test.ts     # Service tests
```

### Documentation
```
UPPERCASE.md            # Root-level docs (README, QUICKSTART)
PascalCase.md           # General documentation
TASK_N_*.md            # Task-specific documentation
```

## 📊 File Statistics

### Frontend (Client)
- **Components**: 20+ React components
- **Tests**: 30+ test files
- **Styles**: 20+ CSS files
- **Total Lines**: ~15,000 lines of code

### Backend (Server)
- **Controllers**: 3 controllers
- **Services**: 5 services
- **Models**: 3 models
- **Middleware**: 6 middleware functions
- **WebSocket**: 6 WebSocket-related files
- **Tests**: 50+ test files
- **Total Lines**: ~20,000 lines of code

### Documentation
- **API Docs**: 5 files
- **Development Docs**: 30+ files
- **Total Pages**: 100+ pages of documentation

## 🔍 Finding Files

### By Feature

**Authentication**:
```
client/src/components/Login.tsx
client/src/components/Register.tsx
client/src/contexts/AuthContext.tsx
server/src/controllers/authController.ts
server/src/services/authService.ts
server/src/middleware/auth.ts
```

**Document Management**:
```
client/src/components/DocumentList.tsx
client/src/components/CreateDocument.tsx
client/src/components/ShareDocument.tsx
server/src/controllers/documentController.ts
server/src/models/Document.ts
```

**Real-Time Collaboration**:
```
client/src/components/EditorContainer.tsx
client/src/components/CollaborativeCursor.tsx
client/src/components/PresenceIndicator.tsx
server/src/websocket/WebSocketServer.ts
server/src/websocket/Room.ts
server/src/websocket/YjsSyncProtocol.ts
```

**Offline Support**:
```
client/src/components/OfflineIndicator.tsx
client/src/hooks/useOfflineDetection.ts
client/src/hooks/useOfflineSync.ts
client/src/services/OfflineQueue.ts
```

**Document History**:
```
client/src/components/DocumentHistory.tsx
client/src/components/VersionPreview.tsx
client/src/components/RestoreConfirmDialog.tsx
server/src/controllers/documentController.ts (history endpoints)
```

### By Type

**Configuration Files**:
```
client/vite.config.ts
client/tsconfig.json
client/playwright.config.ts
server/tsconfig.json
server/src/config/database.ts
server/src/config/redis.ts
docker-compose.yml
```

**Test Files**:
```
client/src/**/*.test.tsx
client/e2e/*.spec.ts
server/src/tests/**/*.test.ts
```

**Documentation**:
```
README.md
QUICKSTART.md
docs/INDEX.md
docs/api/*.md
docs/development/*.md
```

## 🚀 Quick Navigation

### Starting Development

1. **Setup**: `QUICKSTART.md`
2. **Architecture**: `README.md#architecture`
3. **API Reference**: `docs/api/API.md`
4. **Component Guide**: `client/src/components/README.md`

### Understanding Features

1. **Real-Time Sync**: `docs/api/WEBSOCKET.md`
2. **Authentication**: `docs/api/AUTHENTICATION.md`
3. **Offline Mode**: `docs/development/OFFLINE_SUPPORT_SUMMARY.md`
4. **Performance**: `docs/development/TASK_25_PERFORMANCE_OPTIMIZATION.md`

### Testing

1. **E2E Tests**: `docs/development/TASK_25_E2E_TESTING.md`
2. **Unit Tests**: `client/src/**/*.test.tsx` and `server/src/tests/`
3. **Performance Tests**: `server/src/tests/performance/`

## 📝 Notes

### Ignored Files

The following are not tracked in git (see `.gitignore`):
- `node_modules/` - Dependencies
- `dist/` - Build output
- `.env` - Environment variables
- `*.log` - Log files
- Coverage reports

### Generated Files

These files are generated during build/development:
- `client/dist/` - Production build
- `server/dist/` - Compiled TypeScript
- `coverage/` - Test coverage reports

## 🔄 File Organization Principles

1. **Separation of Concerns**: Frontend and backend are separate
2. **Feature-Based**: Components grouped by feature
3. **Test Co-location**: Tests near the code they test
4. **Documentation Hierarchy**: Docs organized by audience and purpose
5. **Configuration Centralization**: Config files in predictable locations

---

**Last Updated**: 2025-12-11

For questions about file organization, see `docs/INDEX.md` or open an issue.
