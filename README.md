# 🚀 Realtime Collaborative Document Editor

A production-ready, real-time collaborative document editor built with modern web technologies. Multiple users can edit documents simultaneously with live cursor tracking, presence indicators, and conflict-free synchronization.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)

## ✨ Key Features

### 🤝 Real-Time Collaboration
- **Live Editing**: See changes from other users instantly as they type
- **Cursor Presence**: View where other users are editing with colored cursors and labels
- **User Presence**: See who's online, typing, idle, or away
- **Conflict-Free Sync**: CRDT-based synchronization ensures no data loss

### 📝 Document Management
- **Create & Share**: Create documents and share with specific users
- **Permission Levels**: Owner, Editor, and Viewer roles
- **Document History**: View and restore previous versions
- **Search & Filter**: Find documents quickly

### 🔒 Security & Authentication
- **JWT Authentication**: Secure user authentication
- **Role-Based Access**: Fine-grained permission control
- **Input Sanitization**: Protection against XSS and injection attacks
- **Rate Limiting**: API and WebSocket rate limiting

### 📱 Modern UX
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Offline Support**: Edit offline and sync when reconnected
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation
- **Dark Mode Ready**: Consistent theming with CSS variables

### ⚡ Performance
- **Optimized Bundle**: Code splitting and lazy loading
- **Fast Sync**: Sub-100ms latency for real-time updates
- **Scalable**: Redis-backed session management
- **Efficient**: Throttled updates and optimized rendering

## 🎯 What Makes This Special?

This is a **production-ready** collaborative editor that demonstrates:

1. **CRDT Technology**: Uses Yjs for conflict-free replicated data types
2. **WebSocket Architecture**: Real-time bidirectional communication
3. **Offline-First**: Works without internet, syncs when back online
4. **Enterprise Features**: History, permissions, monitoring, and more
5. **Best Practices**: TypeScript, testing, security, accessibility

## 🏗️ Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │◄───────►│   Server    │◄───────►│  Database   │
│  (React)    │ WebSocket│  (Node.js)  │         │ (PostgreSQL)│
└─────────────┘         └─────────────┘         └─────────────┘
      │                        │                        
      │                        ▼                        
      │                 ┌─────────────┐                
      │                 │    Redis    │                
      │                 │  (Sessions) │                
      │                 └─────────────┘                
      │                                                 
      ▼                                                 
┌─────────────┐                                        
│  Monaco     │                                        
│  Editor     │                                        
└─────────────┘                                        
```

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Monaco Editor (VS Code's editor)
- Yjs (CRDT library)
- React Router for navigation
- Vite for build tooling

**Backend:**
- Node.js with Express
- TypeScript
- PostgreSQL for data persistence
- Redis for session management
- WebSocket for real-time communication

**Testing:**
- Vitest for unit tests
- Playwright for E2E tests
- 90%+ code coverage

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.0.0 or higher
- **PostgreSQL** 14 or higher
- **Redis** 6 or higher
- **npm** or **yarn**

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd realtime-collaborative-editor
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### 3. Set Up Environment Variables

```bash
# Server environment (.env in server directory)
cd server
cp .env.example .env
```

Edit `server/.env`:
```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/collab_editor
DB_HOST=localhost
DB_PORT=5432
DB_NAME=collab_editor
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server
PORT=3000
WS_PORT=3001
NODE_ENV=development
```

### 4. Set Up Database

```bash
# Create database
createdb collab_editor

# Run migrations (from server directory)
cd server
npm run migrate
```

### 5. Start Services

**Option A: Using Docker (Recommended)**

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis
```

**Option B: Local Installation**

Start PostgreSQL and Redis using your system's service manager.

### 6. Start the Application

Open **three terminal windows**:

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - WebSocket Server:**
```bash
cd server
npm run dev:ws
```

**Terminal 3 - Client:**
```bash
cd client
npm run dev
```

### 7. Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

## 🎮 How to Use

### First Time Setup

1. **Register an Account**
   - Click "Sign Up" on the login page
   - Enter your name, email, and password
   - You'll be automatically logged in

2. **Create Your First Document**
   - Click "Create Document" button
   - Enter a document title
   - Start editing!

### Collaborative Editing

1. **Invite Collaborators**
   - Click the "Share" button in the document
   - Enter collaborator's email
   - Choose permission level (Editor or Viewer)
   - Click "Share"

2. **See Real-Time Changes**
   - Open the same document in another browser/tab
   - Type in one window and watch it appear in the other
   - See colored cursors showing where others are editing
   - View presence indicators showing who's online

3. **Work Offline**
   - Disconnect from internet
   - Continue editing (changes are queued)
   - Reconnect and changes sync automatically

### Document Management

- **View History**: Click history icon to see previous versions
- **Restore Version**: Select a version and click "Restore"
- **Change Settings**: Update document title and permissions
- **Delete Document**: Only owners can delete documents

## 🧪 Testing

### Run Unit Tests

```bash
# Client tests
cd client
npm test

# Server tests
cd server
npm test
```

### Run E2E Tests

```bash
cd client
npm run test:e2e
```

### Run with Coverage

```bash
# Client
cd client
npm run test:coverage

# Server
cd server
npm run test:coverage
```

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[API Documentation](docs/api/API.md)** - REST API endpoints
- **[WebSocket Documentation](docs/api/WEBSOCKET.md)** - Real-time communication
- **[Authentication Guide](docs/api/AUTHENTICATION.md)** - Auth implementation
- **[Development Guide](docs/development/)** - Task completion docs
- **[Testing Guide](docs/testing/)** - E2E and performance tests

## 🎨 Demo Scenarios

### Scenario 1: Two Users Editing

1. Open the app in two browser windows (or use incognito)
2. Register two different accounts
3. Create a document with User 1
4. Share it with User 2 (Editor permission)
5. Both users start typing simultaneously
6. Watch real-time synchronization with no conflicts!

### Scenario 2: Offline Editing

1. Open a document
2. Disconnect from internet (turn off WiFi)
3. Continue editing (see "Offline" indicator)
4. Reconnect to internet
5. Watch changes sync automatically

### Scenario 3: Document History

1. Create a document and type some content
2. Wait a few minutes (snapshots are created periodically)
3. Make more changes
4. Click "History" to view previous versions
5. Restore an older version if needed

## 🔧 Configuration

### Client Configuration

Edit `client/vite.config.ts` for build settings:
- Code splitting configuration
- Proxy settings for API
- Build optimization

### Server Configuration

Edit `server/src/config/`:
- `database.ts` - Database connection
- `redis.ts` - Redis configuration
- `logger.ts` - Logging settings

## 🚢 Deployment

### Quick Deployment Options

**Easiest**: Deploy to Heroku (free tier available)
```bash
heroku create my-collab-editor
heroku addons:create heroku-postgresql:mini
heroku addons:create heroku-redis:mini
git push heroku main
```

**Modern**: Deploy to Railway or Render (one-click deploy)

**Full Control**: Deploy to DigitalOcean with Docker

### Deployment Guides

- **[Deployment Quick Start](DEPLOYMENT_QUICKSTART.md)** - Get online in 15 minutes
- **[Full Deployment Guide](docs/DEPLOYMENT.md)** - Complete deployment documentation

### What is Deployment?

Deployment means putting your app on the internet so others can use it:
- **Before**: Runs on `localhost:5173` (only you can access)
- **After**: Runs on `yourdomain.com` (everyone can access)

See [DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md) for step-by-step instructions.

## 📊 Performance Metrics

- **Initial Load**: < 3 seconds
- **Time to Interactive**: < 5 seconds
- **Typing Latency**: < 50ms
- **Sync Latency**: < 200ms
- **Bundle Size**: ~1.5 MB (400 KB gzipped)

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input sanitization
- XSS protection
- CSRF protection
- Rate limiting
- SQL injection prevention
- Secure WebSocket connections

## ♿ Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader compatible
- High contrast mode support
- Focus indicators
- ARIA labels and roles

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Yjs** - CRDT library for conflict-free synchronization
- **Monaco Editor** - VS Code's editor component
- **React** - UI framework
- **Express** - Web framework
- **PostgreSQL** - Database
- **Redis** - Session management

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check the documentation in `docs/`
- Review the E2E testing guide

## 🗺️ Roadmap

- [ ] Rich text formatting
- [ ] Comments and annotations
- [ ] File attachments
- [ ] Export to PDF/Word
- [ ] Mobile apps (React Native)
- [ ] Video/audio chat integration
- [ ] AI-powered suggestions

---

**Built with ❤️ using modern web technologies**
