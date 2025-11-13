# 🚀 Deployment Guide

## 📖 What is Deployment?

**Deployment** is the process of making your application available on the internet so others can use it.

### Development vs Production

| Aspect | Development (Local) | Production (Deployed) |
|--------|-------------------|---------------------|
| **Access** | Only you (localhost) | Everyone (internet) |
| **URL** | `localhost:5173` | `yourdomain.com` |
| **Database** | Local PostgreSQL | Cloud database |
| **Performance** | Debug mode, slower | Optimized, faster |
| **Security** | Relaxed | Strict |
| **Cost** | Free | Paid (hosting fees) |

### Why Deploy?

- ✅ **Share with others**: Let people use your app
- ✅ **Portfolio**: Show employers your work
- ✅ **Real users**: Get feedback and usage data
- ✅ **24/7 availability**: Always online
- ✅ **Professional**: Real domain name

---

## 🎯 Deployment Options

### Option 1: Docker (Easiest) ⭐ Recommended

**Best for**: Quick deployment, consistent environment

**Pros**:
- Everything packaged together
- Works the same everywhere
- Easy to update

**Cons**:
- Requires Docker knowledge
- Slightly more resources

### Option 2: Cloud Platforms (Most Popular)

**Best for**: Production apps, scalability

Popular platforms:
- **Heroku** - Easiest, free tier available
- **Railway** - Modern, simple
- **Render** - Good free tier
- **DigitalOcean** - More control
- **AWS/Azure/GCP** - Enterprise-grade

### Option 3: VPS (Most Control)

**Best for**: Custom setups, learning

Providers:
- DigitalOcean Droplets
- Linode
- Vultr
- AWS EC2

---

## 🐳 Option 1: Docker Deployment (Recommended)

### What You Need

- Docker installed
- Docker Compose installed
- A server (VPS) or cloud platform

### Step 1: Prepare for Production

**Update environment variables** in `server/.env`:

```env
# Production settings
NODE_ENV=production

# Database (use cloud database)
DATABASE_URL=postgresql://user:password@your-db-host:5432/collab_editor

# Redis (use cloud Redis)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT Secret (IMPORTANT: Change this!)
JWT_SECRET=your-super-secret-production-key-min-32-chars

# Server URLs (use your domain)
PORT=3000
WS_PORT=3001
CLIENT_URL=https://yourdomain.com
```

### Step 2: Build Docker Images

```bash
# Build all services
docker-compose build

# Or build individually
docker build -t collab-editor-client ./client
docker build -t collab-editor-server ./server
```

### Step 3: Deploy with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Step 4: Set Up Database

```bash
# Run migrations
docker-compose exec server npm run migrate

# Or manually
docker-compose exec postgres psql -U postgres -d collab_editor
```

---

## ☁️ Option 2: Deploy to Heroku (Free Tier)

### What You Need

- Heroku account (free)
- Heroku CLI installed
- Git repository

### Step 1: Install Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Windows
# Download from: https://devcenter.heroku.com/articles/heroku-cli

# Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

### Step 2: Login to Heroku

```bash
heroku login
```

### Step 3: Create Heroku Apps

```bash
# Create app for server
heroku create your-app-name-server

# Create app for client
heroku create your-app-name-client
```

### Step 4: Add PostgreSQL and Redis

```bash
# Add PostgreSQL
heroku addons:create heroku-postgresql:mini -a your-app-name-server

# Add Redis
heroku addons:create heroku-redis:mini -a your-app-name-server
```

### Step 5: Set Environment Variables

```bash
# Set JWT secret
heroku config:set JWT_SECRET=your-super-secret-key -a your-app-name-server

# Set Node environment
heroku config:set NODE_ENV=production -a your-app-name-server

# Set client URL
heroku config:set CLIENT_URL=https://your-app-name-client.herokuapp.com -a your-app-name-server
```

### Step 6: Deploy Server

```bash
# From project root
cd server

# Initialize git if needed
git init
git add .
git commit -m "Initial commit"

# Add Heroku remote
heroku git:remote -a your-app-name-server

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate -a your-app-name-server
```

### Step 7: Deploy Client

```bash
# From project root
cd client

# Build for production
npm run build

# Deploy (you'll need to set up static hosting)
# Option A: Use Heroku buildpack
# Option B: Use Netlify/Vercel (see below)
```

---

## 🌐 Option 3: Deploy to Netlify (Client) + Railway (Server)

### Deploy Client to Netlify

**Step 1**: Build the client

```bash
cd client
npm run build
# Creates 'dist' folder
```

**Step 2**: Deploy to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Sign up/login
3. Click "Add new site" → "Deploy manually"
4. Drag and drop the `client/dist` folder
5. Your site is live!

**Step 3**: Set environment variables

In Netlify dashboard:
- Go to Site settings → Environment variables
- Add `VITE_API_URL` = your server URL

### Deploy Server to Railway

**Step 1**: Sign up at [railway.app](https://railway.app)

**Step 2**: Create new project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your repository
4. Select the `server` directory

**Step 3**: Add PostgreSQL and Redis

1. Click "New" → "Database" → "PostgreSQL"
2. Click "New" → "Database" → "Redis"
3. Railway automatically connects them

**Step 4**: Set environment variables

In Railway dashboard:
- `NODE_ENV` = `production`
- `JWT_SECRET` = your secret key
- `CLIENT_URL` = your Netlify URL

**Step 5**: Deploy

Railway automatically deploys on git push!

---

## 🖥️ Option 4: Deploy to VPS (DigitalOcean)

### What You Need

- DigitalOcean account
- Domain name (optional)
- SSH knowledge

### Step 1: Create Droplet

1. Go to [digitalocean.com](https://digitalocean.com)
2. Create account
3. Create Droplet:
   - **Image**: Ubuntu 22.04
   - **Plan**: Basic ($6/month)
   - **Region**: Closest to users
   - **Authentication**: SSH key

### Step 2: Connect to Server

```bash
ssh root@your-droplet-ip
```

### Step 3: Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Redis
apt install -y redis-server

# Install Nginx (web server)
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2
```

### Step 4: Set Up Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE collab_editor;
CREATE USER collab_user WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE collab_editor TO collab_user;
\q
```

### Step 5: Clone and Set Up Project

```bash
# Clone repository
cd /var/www
git clone your-repo-url collab-editor
cd collab-editor

# Install dependencies
npm install
cd client && npm install && npm run build
cd ../server && npm install && npm run build
```

### Step 6: Configure Environment

```bash
# Create .env file
cd /var/www/collab-editor/server
nano .env

# Add production settings (see above)
```

### Step 7: Start with PM2

```bash
# Start server
cd /var/www/collab-editor/server
pm2 start dist/index.js --name collab-server

# Start WebSocket server
pm2 start dist/websocket/WebSocketServer.js --name collab-ws

# Save PM2 configuration
pm2 save
pm2 startup
```

### Step 8: Configure Nginx

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/collab-editor
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Client (static files)
    location / {
        root /var/www/collab-editor/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/collab-editor /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 9: Set Up SSL (HTTPS)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
```

---

## 🔒 Production Checklist

Before deploying to production:

### Security
- [ ] Change JWT_SECRET to strong random string
- [ ] Use HTTPS (SSL certificate)
- [ ] Set NODE_ENV=production
- [ ] Enable CORS only for your domain
- [ ] Use strong database passwords
- [ ] Enable firewall
- [ ] Keep dependencies updated

### Performance
- [ ] Build client with `npm run build`
- [ ] Enable gzip compression
- [ ] Use CDN for static assets (optional)
- [ ] Set up database indexes
- [ ] Configure Redis caching

### Monitoring
- [ ] Set up error logging
- [ ] Monitor server resources
- [ ] Set up uptime monitoring
- [ ] Configure backup strategy

### Database
- [ ] Run migrations
- [ ] Set up automated backups
- [ ] Use connection pooling
- [ ] Monitor query performance

---

## 💰 Cost Estimates

### Free Tier Options

| Service | Free Tier | Limitations |
|---------|-----------|-------------|
| **Heroku** | Yes | Sleeps after 30min inactivity |
| **Railway** | $5 credit/month | Limited resources |
| **Render** | Yes | Slower performance |
| **Netlify** | Yes (client only) | 100GB bandwidth |
| **Vercel** | Yes (client only) | 100GB bandwidth |

### Paid Options

| Service | Cost/Month | Best For |
|---------|------------|----------|
| **DigitalOcean** | $6-12 | Full control |
| **Heroku** | $7-25 | Easy management |
| **AWS** | $10-50+ | Scalability |
| **Railway** | $10-20 | Modern apps |

---

## 🔄 Updating Your Deployment

### Docker

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Heroku

```bash
git push heroku main
```

### VPS

```bash
# Pull latest code
cd /var/www/collab-editor
git pull

# Rebuild
cd client && npm run build
cd ../server && npm run build

# Restart
pm2 restart all
```

---

## 🐛 Troubleshooting Deployment

### "Cannot connect to database"

```bash
# Check database is running
docker-compose ps  # Docker
systemctl status postgresql  # VPS

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

### "WebSocket connection failed"

- Check firewall allows port 3001
- Verify WS_PORT in environment
- Check Nginx WebSocket configuration
- Ensure HTTPS for wss:// connections

### "502 Bad Gateway"

- Server not running: `pm2 status`
- Wrong port in Nginx config
- Firewall blocking connection

### "Out of memory"

- Increase server resources
- Check for memory leaks
- Optimize database queries
- Use Redis caching

---

## 📚 Additional Resources

### Documentation
- [Docker Documentation](https://docs.docker.com/)
- [Heroku Dev Center](https://devcenter.heroku.com/)
- [DigitalOcean Tutorials](https://www.digitalocean.com/community/tutorials)
- [Nginx Documentation](https://nginx.org/en/docs/)

### Tools
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Let's Encrypt](https://letsencrypt.org/) - Free SSL
- [Cloudflare](https://www.cloudflare.com/) - CDN and DDoS protection

---

## 🎓 Learning Path

1. **Start Simple**: Deploy to Heroku or Railway (free tier)
2. **Learn Docker**: Use Docker Compose locally
3. **Try VPS**: Deploy to DigitalOcean for more control
4. **Scale Up**: Move to AWS/Azure when you need more

---

## 📞 Need Help?

- Check logs: `docker-compose logs` or `pm2 logs`
- Review error messages carefully
- Search for specific errors online
- Ask in developer communities

---

**Remember**: Deployment is a learning process. Start simple, and gradually move to more complex setups as you learn!

Good luck with your deployment! 🚀
