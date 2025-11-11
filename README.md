# Real-Time Collaborative Editor

A production-ready real-time collaborative text editor built with the MERN stack, featuring WebSocket communication, Yjs CRDT for conflict-free convergence, JWT authentication, and MongoDB persistence with operation logs.

## Features

- **Real-Time Collaboration**: Multiple users can edit the same document simultaneously
- **Conflict-Free Editing**: Yjs CRDT ensures all clients converge to the same state
- **Shared Cursors**: See where other users are typing with color-coded cursors
- **Offline Support**: Continue editing offline with automatic sync on reconnection
- **Document Management**: Create, share, and manage documents with role-based permissions
- **Version History**: Track all changes with operation logs and time-travel capabilities
- **Authentication**: Secure JWT-based authentication with refresh tokens
- **Scalable Architecture**: Redis pub/sub for horizontal scaling across multiple servers
- **Production Ready**: Docker support, CI/CD pipelines, monitoring, and health checks

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Prerequisites

### Required

- **Node.js**: 20.x or higher ([Download](https://nodejs.org/))
- **npm**: 10.x or higher (comes with Node.js)
- **MongoDB**: 7.x or higher ([Download](https://www.mongodb.com/try/download/community))

### Optional (for production)

- **Redis**: 7.x or higher ([Download](https://redis.io/download)) - Required for multi-server scaling
- **Docker**: 24.x or higher ([Download](https://www.docker.com/get-started)) - For containerized deployment
- **Docker Compose**: 2.x or higher - For local Docker development

### System Requirements

- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: 2GB free space
- **OS**: macOS, Linux, or Windows with WSL2

---

## Quick Start

Get up and running in 5 minutes:

```bash
# 1. Clone the repository
git clone <repository-url>
cd realtime-collaborative-editor

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env

# 4. Start MongoDB (if not running)
# macOS with Homebrew:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod

# 5. Start the application
npm run dev
```

**Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health/ready

---

## Development Setup

### Step 1: Install Dependencies

Install all dependencies for both client and server:

```bash
npm install
```

This uses npm workspaces to install dependencies for both the client and server.

### Step 2: Configure Environment Variables

#### Server Configuration

Create a `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/collaborative_editor

# Redis Configuration (optional for single-server development)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets (generate secure random strings for production)
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=debug
```

#### Client Configuration

Create a `.env` file in the `client` directory:

```bash
cd client
cp .env.example .env
```

Edit `client/.env` with your configuration:

```env
# API Configuration
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### Step 3: Start MongoDB

**macOS (Homebrew):**
```bash
brew services start mongodb-community
```

**Linux (systemd):**
```bash
sudo systemctl start mongod
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:7
```

### Step 4: Start Redis (Optional)

Redis is optional for single-server development but required for production scaling.

**macOS (Homebrew):**
```bash
brew services start redis
```

**Linux (systemd):**
```bash
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### Step 5: Start Development Servers

**Option 1: Start both servers together (recommended)**

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

**Option 2: Start servers separately**

```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

### Step 6: Verify Installation

1. **Check Backend Health:**
   ```bash
   curl http://localhost:3001/health/ready
   ```
   Should return: `{"status":"ready",...}`

2. **Open Frontend:**
   Navigate to http://localhost:5173

3. **Register a User:**
   - Click "Register" and create an account
   - You should be redirected to the document list

4. **Create a Document:**
   - Click "Create Document"
   - Start typing to test real-time sync

---

## Docker Deployment

### Using Docker Compose (Recommended for Local Development)

Docker Compose provides a complete environment with MongoDB, Redis, backend, and frontend.

#### Step 1: Configure Environment

```bash
cp .env.docker.example .env
```

Edit `.env` with your configuration (change passwords in production!):

```env
NODE_ENV=production
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=change-this-password
MONGO_DATABASE=collaborative_editor
REDIS_PASSWORD=change-this-redis-password
JWT_SECRET=your-very-secure-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-key-min-32-chars
CORS_ORIGIN=http://localhost:3000
SERVER_PORT=3001
CLIENT_PORT=3000
```

#### Step 2: Start Services

```bash
docker-compose up -d
```

This starts:
- MongoDB on port 27017
- Redis on port 6379
- Backend server on port 3001
- Frontend client on port 3000

#### Step 3: Verify Deployment

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Check backend health
curl http://localhost:3001/health/ready

# Access frontend
open http://localhost:3000
```

#### Step 4: Stop Services

```bash
docker-compose down

# To remove volumes (data will be lost):
docker-compose down -v
```

### Building Individual Docker Images

**Build Backend:**
```bash
cd server
docker build -t collab-editor-server:latest .
```

**Build Frontend:**
```bash
cd client
docker build -t collab-editor-client:latest .
```

**Run Backend:**
```bash
docker run -d \
  -p 3001:3001 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/collaborative_editor \
  -e JWT_SECRET=your-secret \
  --name collab-server \
  collab-editor-server:latest
```

**Run Frontend:**
```bash
docker run -d \
  -p 3000:8080 \
  --name collab-client \
  collab-editor-client:latest
```

---

## Environment Variables

### Server Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | No | `3001` | Server port |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `REDIS_HOST` | No | `localhost` | Redis host (optional for single-server) |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password |
| `JWT_SECRET` | Yes | - | Secret for access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | - | Secret for refresh tokens (min 32 chars) |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins (comma-separated) |
| `LOG_LEVEL` | No | `info` | Logging level (`error`, `warn`, `info`, `debug`) |

### Client Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | - | Backend API URL (e.g., `http://localhost:3001`) |
| `VITE_WS_URL` | Yes | - | WebSocket URL (e.g., `ws://localhost:3001`) |

### Generating Secure Secrets

For production, generate secure random secrets:

```bash
# Generate JWT secrets (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32
```

---

## Project Structure

```
.
├── .github/
│   └── workflows/          # CI/CD pipeline configurations
│       ├── ci.yml          # Continuous Integration
│       └── cd.yml          # Continuous Deployment
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts (Auth, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API and service layer
│   │   └── tests/          # Test utilities
│   ├── Dockerfile          # Frontend Docker image
│   ├── nginx.conf          # Nginx configuration
│   └── package.json
├── server/                 # Node.js/Express backend
│   ├── src/
│   │   ├── config/         # Configuration (DB, Redis, Logger)
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic services
│   │   ├── utils/          # Utility functions
│   │   ├── websocket/      # WebSocket server and rooms
│   │   └── tests/          # Test files
│   ├── Dockerfile          # Backend Docker image
│   └── package.json
├── docs/                   # Documentation
│   ├── API.md              # API documentation
│   ├── WEBSOCKET.md        # WebSocket protocol docs
│   └── postman_collection.json
├── docker-compose.yml      # Docker Compose configuration
├── .env.docker.example     # Docker environment template
└── package.json            # Root workspace configuration
```

---

## Available Scripts

### Root Level Scripts

```bash
# Development
npm run dev              # Start both client and server
npm run dev:server       # Start server only
npm run dev:client       # Start client only

# Building
npm run build            # Build both client and server
npm run build:server     # Build server only
npm run build:client     # Build client only

# Testing
npm run test             # Run all tests
npm run test:server      # Run server tests
npm run test:client      # Run client tests
npm run test:coverage    # Run tests with coverage

# Code Quality
npm run lint             # Lint all code
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier
```

### Server Scripts

```bash
cd server

npm run dev              # Start in development mode with hot reload
npm run build            # Compile TypeScript to JavaScript
npm run start            # Start production server
npm run lint             # Lint TypeScript code
npm run lint:fix         # Fix linting issues
npm run type-check       # Check TypeScript types
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:ci          # Run tests with coverage for CI
```

### Client Scripts

```bash
cd client

npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Lint TypeScript/React code
npm run lint:fix         # Fix linting issues
npm run type-check       # Check TypeScript types
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Run tests with UI
npm run test:ci          # Run tests with coverage for CI
```

---

## API Documentation

Comprehensive API documentation is available in the `docs` directory:

- **[API Reference](docs/API.md)** - Complete REST API documentation with examples
- **[WebSocket Protocol](docs/WEBSOCKET.md)** - WebSocket message protocol and integration guide
- **[Postman Collection](docs/postman_collection.json)** - Import into Postman for API testing

### Quick API Overview

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

**Documents:**
- `POST /api/documents` - Create document
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document
- `PATCH /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/share` - Share document
- `GET /api/documents/:id/history` - Get operation history

**Health:**
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /metrics` - Prometheus metrics

---

## Testing

### Running Tests

**All Tests:**
```bash
npm run test
```

**Server Tests:**
```bash
npm run test:server
```

**Client Tests:**
```bash
npm run test:client
```

**With Coverage:**
```bash
npm run test:coverage
```

**Watch Mode:**
```bash
cd server && npm run test:watch
cd client && npm run test:watch
```

### Test Structure

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database operations
- **Component Tests**: Test React components with React Testing Library
- **E2E Tests**: (Future) End-to-end tests with Playwright

### Writing Tests

Tests are located alongside source files with `.test.ts` or `.test.tsx` extensions.

**Example Server Test:**
```typescript
// server/src/models/User.test.ts
import { describe, it, expect } from 'vitest';
import { User } from './User';

describe('User Model', () => {
  it('should hash password on creation', async () => {
    const user = await User.createUser('test@example.com', 'password123', 'Test User');
    expect(user.passwordHash).not.toBe('password123');
  });
});
```

**Example Client Test:**
```typescript
// client/src/components/Login.test.tsx
import { render, screen } from '@testing-library/react';
import { Login } from './Login';

describe('Login Component', () => {
  it('should render login form', () => {
    render(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
```

---

## Deployment

### Production Deployment Checklist

- [ ] Generate secure JWT secrets (32+ characters)
- [ ] Set `NODE_ENV=production`
- [ ] Configure MongoDB with authentication
- [ ] Set up Redis for multi-server scaling
- [ ] Configure CORS with specific origins
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline
- [ ] Test health check endpoints
- [ ] Configure rate limiting
- [ ] Review security headers

### Deployment Options

#### 1. Docker Compose (Simple)

Best for small deployments or staging environments.

```bash
# Production docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

#### 2. Kubernetes (Scalable)

Best for production with high availability.

```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: collab-editor-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: collab-editor-server
  template:
    metadata:
      labels:
        app: collab-editor-server
    spec:
      containers:
      - name: server
        image: ghcr.io/your-org/collab-editor-server:latest
        ports:
        - containerPort: 3001
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: collab-secrets
              key: mongodb-uri
```

#### 3. Cloud Platforms

**AWS:**
- ECS/Fargate for containers
- DocumentDB for MongoDB
- ElastiCache for Redis
- ALB for load balancing

**Google Cloud:**
- Cloud Run for containers
- Cloud MongoDB Atlas
- Cloud Memorystore for Redis
- Cloud Load Balancing

**Azure:**
- Container Instances
- Cosmos DB (MongoDB API)
- Azure Cache for Redis
- Application Gateway

### CI/CD Pipeline

The project includes GitHub Actions workflows:

**Continuous Integration (`.github/workflows/ci.yml`):**
- Runs on every push and pull request
- Lints code
- Runs type checking
- Executes tests with coverage
- Builds Docker images
- Security audit

**Continuous Deployment (`.github/workflows/cd.yml`):**
- Runs on push to `main` branch
- Builds and pushes Docker images to registry
- Deploys to staging environment
- Runs smoke tests
- Deploys to production (on tags)
- Blue-green deployment with automatic rollback

---

## Monitoring

### Health Checks

**Liveness Probe:**
```bash
curl http://localhost:3001/health/live
```

**Readiness Probe:**
```bash
curl http://localhost:3001/health/ready
```

### Metrics

Prometheus metrics are exposed at `/metrics`:

```bash
curl http://localhost:3001/metrics
```

**Key Metrics:**
- `http_request_duration_seconds` - Request latency histogram
- `websocket_connections_total` - Active WebSocket connections
- `operations_per_second` - Document operations rate
- `mongodb_connection_status` - Database connection health
- `redis_connection_status` - Redis connection health

### Logging

Structured JSON logs with Winston:

```json
{
  "level": "info",
  "message": "Operation applied",
  "correlationId": "abc123",
  "documentId": "507f1f77bcf86cd799439012",
  "userId": "507f1f77bcf86cd799439011",
  "operationType": "insert",
  "latencyMs": 45,
  "timestamp": "2025-01-16T15:30:00.000Z"
}
```

**Log Levels:**
- `error` - Unrecoverable errors
- `warn` - Recoverable errors, permission violations
- `info` - Normal operations, user actions
- `debug` - Detailed operation data

---

## Troubleshooting

### Common Issues

#### MongoDB Connection Failed

**Error:** `MongooseServerSelectionError: connect ECONNREFUSED`

**Solutions:**
1. Verify MongoDB is running:
   ```bash
   # macOS
   brew services list | grep mongodb
   
   # Linux
   sudo systemctl status mongod
   ```

2. Check connection string in `.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/collaborative_editor
   ```

3. Test connection:
   ```bash
   mongosh mongodb://localhost:27017
   ```

#### Redis Connection Failed

**Error:** `Error: Redis connection failed`

**Solutions:**
1. Redis is optional for single-server development
2. Start Redis if needed:
   ```bash
   # macOS
   brew services start redis
   
   # Linux
   sudo systemctl start redis
   ```

3. Or disable Redis in development by commenting out Redis configuration

#### WebSocket Connection Refused

**Error:** `WebSocket connection failed`

**Solutions:**
1. Verify backend is running on port 3001
2. Check `VITE_WS_URL` in `client/.env`:
   ```env
   VITE_WS_URL=ws://localhost:3001
   ```

3. Check browser console for CORS errors
4. Verify JWT token is valid

#### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solutions:**
1. Find and kill process using the port:
   ```bash
   # macOS/Linux
   lsof -ti:3001 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

2. Or change port in `.env`:
   ```env
   PORT=3002
   ```

#### JWT Token Expired

**Error:** `401 Unauthorized: Token expired`

**Solutions:**
1. Use refresh token to get new access token:
   ```bash
   curl -X POST http://localhost:3001/api/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
   ```

2. Or login again to get new tokens

#### Document Not Syncing

**Problem:** Changes not appearing for other users

**Solutions:**
1. Check WebSocket connection status in browser console
2. Verify both users are in the same document
3. Check server logs for errors
4. Reload page to force full sync
5. Verify MongoDB is running and accessible

### Getting Help

1. **Check Documentation:**
   - [API Documentation](docs/API.md)
   - [WebSocket Protocol](docs/WEBSOCKET.md)

2. **Check Logs:**
   ```bash
   # Server logs
   npm run dev:server
   
   # Docker logs
   docker-compose logs -f server
   ```

3. **Enable Debug Logging:**
   ```env
   LOG_LEVEL=debug
   ```

4. **Health Checks:**
   ```bash
   curl http://localhost:3001/health/ready
   ```

---

## Technology Stack

### Frontend

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Yjs** - CRDT library for conflict-free editing
- **y-websocket** - WebSocket provider for Yjs
- **Monaco Editor** - Code editor component
- **React Router** - Client-side routing
- **Vitest** - Testing framework

### Backend

- **Node.js 20** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type safety
- **WebSocket (ws)** - WebSocket server
- **Yjs** - CRDT operations
- **MongoDB** - Document database
- **Mongoose** - MongoDB ODM
- **Redis** - Pub/sub and caching
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **Winston** - Logging
- **Prometheus** - Metrics
- **Vitest** - Testing framework

### DevOps

- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **GitHub Actions** - CI/CD pipelines
- **nginx** - Frontend web server
- **ESLint** - Code linting
- **Prettier** - Code formatting

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run tests:** `npm run test`
5. **Run linter:** `npm run lint`
6. **Commit changes:** `git commit -m 'Add amazing feature'`
7. **Push to branch:** `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Code Style

- Follow existing code style
- Use TypeScript for type safety
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Acknowledgments

- [Yjs](https://github.com/yjs/yjs) - CRDT library
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Express](https://expressjs.com/) - Web framework
- [React](https://react.dev/) - UI library

---

## Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting guide above
