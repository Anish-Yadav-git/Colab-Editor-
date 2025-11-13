# ⚡ Quick Start Guide

Get the Realtime Collaborative Document Editor running in **5 minutes**!

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] PostgreSQL 14+ installed and running
- [ ] Redis 6+ installed and running
- [ ] Git installed

## 🚀 Installation Steps

### Step 1: Clone and Install (2 minutes)

```bash
# Clone the repository
git clone <repository-url>
cd realtime-collaborative-editor

# Install all dependencies
npm install
cd client && npm install
cd ../server && npm install
cd ..
```

### Step 2: Database Setup (1 minute)

```bash
# Create the database
createdb collab_editor

# Or using psql
psql -U postgres
CREATE DATABASE collab_editor;
\q
```

### Step 3: Configure Environment (1 minute)

```bash
# Create server environment file
cd server
cat > .env << 'EOF'
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

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Server Ports
PORT=3000
WS_PORT=3001
NODE_ENV=development
EOF
```

**Important**: Update `DB_PASSWORD` to match your PostgreSQL password!

### Step 4: Run Database Migrations (30 seconds)

```bash
# From the server directory
npm run migrate
```

You should see:
```
✓ Migration completed successfully
✓ Tables created: users, documents, document_permissions, operations
```

### Step 5: Start the Application (30 seconds)

Open **3 terminal windows**:

**Terminal 1 - API Server:**
```bash
cd server
npm run dev
```
Wait for: `✓ Server running on http://localhost:3000`

**Terminal 2 - WebSocket Server:**
```bash
cd server
npm run dev:ws
```
Wait for: `✓ WebSocket server running on ws://localhost:3001`

**Terminal 3 - Client:**
```bash
cd client
npm run dev
```
Wait for: `✓ Local: http://localhost:5173`

## 🎉 You're Ready!

Open your browser to: **http://localhost:5173**

## 🎮 First Steps

### 1. Create Your Account (30 seconds)

1. Click **"Sign Up"**
2. Fill in:
   - Name: `Your Name`
   - Email: `you@example.com`
   - Password: `password123` (min 8 characters)
3. Click **"Create Account"**

You'll be automatically logged in and see the documents page.

### 2. Create Your First Document (15 seconds)

1. Click **"Create Document"** button
2. Enter title: `My First Collaborative Doc`
3. Click **"Create"**

You're now in the editor!

### 3. Test Real-Time Collaboration (1 minute)

**Option A: Two Browser Windows**

1. Copy the document URL from your browser
2. Open a new **incognito/private window**
3. Register a second account
4. Paste the document URL (you'll see "Document not found" - this is expected)
5. Go back to first window
6. Click **"Share"** button
7. Enter second user's email
8. Select **"Editor"** permission
9. Click **"Share"**
10. Refresh the second window
11. Start typing in both windows!

**Option B: Two Devices**

1. Open the app on your phone/tablet: `http://YOUR_IP:5173`
2. Register a new account
3. Share the document from your computer
4. Edit from both devices simultaneously!

### 4. See the Magic ✨

Watch as:
- ✅ Text appears instantly in both windows
- ✅ Colored cursors show where others are typing
- ✅ User avatars appear in the top-right
- ✅ Presence indicators show who's online
- ✅ No conflicts, even when typing at the same spot!

## 🎯 Quick Feature Tour

### Document Management

```
Documents Page → Create Document → Enter Title → Start Editing
```

### Sharing

```
Open Document → Share Button → Enter Email → Choose Permission → Share
```

### History

```
Open Document → History Icon → View Versions → Restore (if needed)
```

### Offline Mode

```
Disconnect WiFi → Keep Editing → Reconnect → Auto-Sync!
```

## 🐛 Troubleshooting

### "Cannot connect to database"

```bash
# Check if PostgreSQL is running
pg_isready

# If not running, start it:
# macOS:
brew services start postgresql

# Linux:
sudo systemctl start postgresql

# Windows:
# Start PostgreSQL service from Services app
```

### "Redis connection failed"

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start it:
# macOS:
brew services start redis

# Linux:
sudo systemctl start redis

# Windows:
# Download and run Redis from: https://redis.io/download
```

### "Port already in use"

```bash
# Find and kill the process using the port
# macOS/Linux:
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "Migration failed"

```bash
# Drop and recreate database
dropdb collab_editor
createdb collab_editor

# Run migrations again
cd server
npm run migrate
```

### Client won't start

```bash
# Clear cache and reinstall
cd client
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 🔧 Using Docker (Alternative)

If you prefer Docker:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the app at: **http://localhost:5173**

## 📱 Testing on Mobile

1. Find your computer's IP address:
   ```bash
   # macOS/Linux:
   ifconfig | grep "inet "
   
   # Windows:
   ipconfig
   ```

2. On your mobile device, open:
   ```
   http://YOUR_IP_ADDRESS:5173
   ```

3. Make sure your phone is on the same WiFi network!

## 🎓 Next Steps

Now that you're up and running:

1. **Read the full README**: `README.md`
2. **Explore the API**: `docs/api/API.md`
3. **Check out features**: Try offline mode, history, sharing
4. **Run tests**: `npm test` in client and server directories
5. **Review architecture**: `docs/architecture/`

## 💡 Pro Tips

### Faster Development

```bash
# Use nodemon for auto-restart
cd server
npm install -g nodemon
nodemon src/index.ts
```

### Better Logging

```bash
# Enable debug logs
export DEBUG=*
npm run dev
```

### Database GUI

Use a PostgreSQL GUI tool:
- **pgAdmin**: https://www.pgadmin.org/
- **DBeaver**: https://dbeaver.io/
- **TablePlus**: https://tableplus.com/

Connection details:
- Host: `localhost`
- Port: `5432`
- Database: `collab_editor`
- User: `postgres`
- Password: (your password)

### Redis GUI

Use a Redis GUI tool:
- **RedisInsight**: https://redis.com/redis-enterprise/redis-insight/
- **Medis**: https://getmedis.com/

## 🎬 Demo Script

Want to show this to someone? Follow this script:

### 1. Introduction (30 seconds)
"This is a real-time collaborative document editor, like Google Docs, but built from scratch with modern web technologies."

### 2. Create Document (15 seconds)
"Let me create a new document..." [Create and open]

### 3. Show Real-Time Editing (1 minute)
"Now watch this - I'll open the same document in another window..." [Open incognito, share, edit from both]

### 4. Highlight Features (1 minute)
- "See the colored cursors? That shows where the other user is typing."
- "The avatars up here show who's online."
- "If I go offline..." [Disconnect] "...I can still edit, and it syncs when I reconnect."

### 5. Show History (30 seconds)
"We also have version history..." [Open history, show versions]

### 6. Wrap Up (15 seconds)
"It's built with React, Node.js, PostgreSQL, and uses CRDTs for conflict-free synchronization."

## 📞 Need Help?

- **Documentation**: Check `docs/` directory
- **Issues**: Open a GitHub issue
- **Testing**: See `docs/testing/TASK_25_E2E_TESTING.md`

## ✅ Success Checklist

You're all set if you can:

- [ ] Register a new account
- [ ] Create a document
- [ ] Edit the document
- [ ] Share with another user
- [ ] See real-time changes from both users
- [ ] View document history
- [ ] Edit offline and sync when reconnected

---

**Happy Collaborating! 🎉**

If you got stuck, check the troubleshooting section or open an issue.
