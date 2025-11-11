# Deployment Guide

This guide covers deploying the Real-Time Collaborative Editor to production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Cloud Platform Deployment](#cloud-platform-deployment)
6. [Database Setup](#database-setup)
7. [SSL/TLS Configuration](#ssltls-configuration)
8. [Monitoring Setup](#monitoring-setup)
9. [Backup Strategy](#backup-strategy)
10. [Scaling Considerations](#scaling-considerations)
11. [Security Hardening](#security-hardening)
12. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Checklist

Before deploying to production, ensure you have completed the following:

### Security

- [ ] Generate secure JWT secrets (minimum 32 characters)
- [ ] Enable MongoDB authentication
- [ ] Set Redis password
- [ ] Configure CORS with specific allowed origins
- [ ] Enable HTTPS/TLS for all connections
- [ ] Review and configure security headers
- [ ] Set up rate limiting
- [ ] Enable input validation and sanitization
- [ ] Configure firewall rules

### Infrastructure

- [ ] Provision MongoDB cluster (replica set recommended)
- [ ] Provision Redis cluster for pub/sub
- [ ] Set up load balancer
- [ ] Configure DNS records
- [ ] Obtain SSL/TLS certificates
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Plan backup strategy

### Application

- [ ] Set `NODE_ENV=production`
- [ ] Build and test Docker images
- [ ] Run all tests and ensure they pass
- [ ] Perform security audit (`npm audit`)
- [ ] Review and optimize bundle sizes
- [ ] Configure environment variables
- [ ] Test health check endpoints
- [ ] Verify WebSocket connections work through load balancer

### Documentation

- [ ] Document deployment architecture
- [ ] Create runbooks for common operations
- [ ] Document rollback procedures
- [ ] Create incident response plan
- [ ] Document monitoring and alerting setup

---

## Environment Configuration

### Production Environment Variables

Create a secure `.env` file with production values:

```env
# Application
NODE_ENV=production
PORT=3001

# MongoDB (use connection string with authentication)
MONGODB_URI=mongodb://username:password@mongodb-host:27017/collaborative_editor?authSource=admin&replicaSet=rs0

# Redis (use password and TLS if available)
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=secure-redis-password
REDIS_TLS=true

# JWT Secrets (MUST be different from development)
JWT_SECRET=<generate-secure-32-char-secret>
JWT_REFRESH_SECRET=<generate-secure-32-char-secret>

# CORS (specify exact origins)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Generating Secure Secrets

Use cryptographically secure random strings:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## Docker Deployment

### Building Production Images

#### Backend Image

```bash
cd server
docker build -t collab-editor-server:v1.0.0 .
```

#### Frontend Image

```bash
cd client
docker build -t collab-editor-client:v1.0.0 .
```

### Docker Compose Production Setup

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - mongodb_data:/data/db
    networks:
      - backend
    command: mongod --replSet rs0

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - backend

  server:
    image: collab-editor-server:v1.0.0
    restart: always
    depends_on:
      - mongodb
      - redis
    environment:
      NODE_ENV: production
      MONGODB_URI: ${MONGODB_URI}
      REDIS_HOST: redis
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    networks:
      - backend
      - frontend
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  client:
    image: collab-editor-client:v1.0.0
    restart: always
    networks:
      - frontend
    deploy:
      replicas: 2

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - frontend
    depends_on:
      - server
      - client

volumes:
  mongodb_data:
  redis_data:

networks:
  backend:
  frontend:
```

### Deploy with Docker Compose

```bash
# Load environment variables
export $(cat .env | xargs)

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale server=5
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Helm 3 (optional)

### Kubernetes Manifests

#### Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: collab-editor
```

#### ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: collab-editor-config
  namespace: collab-editor
data:
  NODE_ENV: "production"
  PORT: "3001"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  LOG_LEVEL: "info"
```

#### Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: collab-editor-secrets
  namespace: collab-editor
type: Opaque
stringData:
  mongodb-uri: "mongodb://username:password@mongodb:27017/collaborative_editor"
  redis-password: "your-redis-password"
  jwt-secret: "your-jwt-secret"
  jwt-refresh-secret: "your-jwt-refresh-secret"
```

#### Server Deployment

```yaml
# server-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: collab-editor-server
  namespace: collab-editor
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
        image: ghcr.io/your-org/collab-editor-server:v1.0.0
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: collab-editor-config
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: collab-editor-secrets
              key: mongodb-uri
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: collab-editor-secrets
              key: redis-password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: collab-editor-secrets
              key: jwt-secret
        - name: JWT_REFRESH_SECRET
          valueFrom:
            secretKeyRef:
              name: collab-editor-secrets
              key: jwt-refresh-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
```

#### Server Service

```yaml
# server-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: collab-editor-server
  namespace: collab-editor
spec:
  selector:
    app: collab-editor-server
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

#### Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: collab-editor-ingress
  namespace: collab-editor
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/websocket-services: "collab-editor-server"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - yourdomain.com
    secretName: collab-editor-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: collab-editor-server
            port:
              number: 3001
      - path: /
        pathType: Prefix
        backend:
          service:
            name: collab-editor-client
            port:
              number: 8080
```

### Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create secrets (use kubectl create secret instead of YAML for security)
kubectl create secret generic collab-editor-secrets \
  --from-literal=mongodb-uri='mongodb://...' \
  --from-literal=redis-password='...' \
  --from-literal=jwt-secret='...' \
  --from-literal=jwt-refresh-secret='...' \
  -n collab-editor

# Apply configurations
kubectl apply -f configmap.yaml
kubectl apply -f server-deployment.yaml
kubectl apply -f server-service.yaml
kubectl apply -f client-deployment.yaml
kubectl apply -f client-service.yaml
kubectl apply -f ingress.yaml

# Check status
kubectl get pods -n collab-editor
kubectl get services -n collab-editor
kubectl get ingress -n collab-editor

# View logs
kubectl logs -f deployment/collab-editor-server -n collab-editor

# Scale deployment
kubectl scale deployment collab-editor-server --replicas=5 -n collab-editor
```

---

## Cloud Platform Deployment

### AWS Deployment

#### Using ECS Fargate

1. **Create ECR Repositories:**
   ```bash
   aws ecr create-repository --repository-name collab-editor-server
   aws ecr create-repository --repository-name collab-editor-client
   ```

2. **Push Images:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
   
   docker tag collab-editor-server:v1.0.0 <account-id>.dkr.ecr.us-east-1.amazonaws.com/collab-editor-server:v1.0.0
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/collab-editor-server:v1.0.0
   ```

3. **Create ECS Cluster:**
   ```bash
   aws ecs create-cluster --cluster-name collab-editor-cluster
   ```

4. **Create Task Definition** (use AWS Console or CloudFormation)

5. **Create Service:**
   ```bash
   aws ecs create-service \
     --cluster collab-editor-cluster \
     --service-name collab-editor-server \
     --task-definition collab-editor-server:1 \
     --desired-count 3 \
     --launch-type FARGATE
   ```

#### Database Setup

- **MongoDB:** Use MongoDB Atlas or DocumentDB
- **Redis:** Use ElastiCache for Redis

### Google Cloud Deployment

#### Using Cloud Run

1. **Build and Push Images:**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/collab-editor-server
   ```

2. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy collab-editor-server \
     --image gcr.io/PROJECT_ID/collab-editor-server \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV=production
   ```

#### Database Setup

- **MongoDB:** Use MongoDB Atlas
- **Redis:** Use Cloud Memorystore

### Azure Deployment

#### Using Container Instances

1. **Create Resource Group:**
   ```bash
   az group create --name collab-editor-rg --location eastus
   ```

2. **Deploy Container:**
   ```bash
   az container create \
     --resource-group collab-editor-rg \
     --name collab-editor-server \
     --image your-registry/collab-editor-server:v1.0.0 \
     --cpu 1 --memory 1 \
     --ports 3001 \
     --environment-variables NODE_ENV=production
   ```

#### Database Setup

- **MongoDB:** Use Cosmos DB (MongoDB API)
- **Redis:** Use Azure Cache for Redis

---

## Database Setup

### MongoDB Production Configuration

#### Replica Set Setup

```bash
# Initialize replica set
mongosh --eval "rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: 'mongodb1:27017' },
    { _id: 1, host: 'mongodb2:27017' },
    { _id: 2, host: 'mongodb3:27017' }
  ]
})"

# Create application user
mongosh --eval "
  use admin
  db.createUser({
    user: 'collab_app',
    pwd: 'secure-password',
    roles: [
      { role: 'readWrite', db: 'collaborative_editor' }
    ]
  })
"
```

#### Indexes

Create indexes for optimal performance:

```javascript
// Documents collection
db.documents.createIndex({ ownerId: 1, createdAt: -1 });
db.documents.createIndex({ 'permissions.userId': 1 });
db.documents.createIndex({ isDeleted: 1, updatedAt: -1 });

// Operations collection
db.operations.createIndex({ documentId: 1, timestamp: -1 });
db.operations.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 2592000 } // 30 days TTL
);

// Users collection
db.users.createIndex({ email: 1 }, { unique: true });
```

### Redis Production Configuration

```conf
# redis.conf
bind 0.0.0.0
protected-mode yes
port 6379
requirepass your-secure-password

# Persistence
appendonly yes
appendfsync everysec

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

---

## SSL/TLS Configuration

### Using Let's Encrypt with Nginx

```nginx
# nginx.conf
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # WebSocket support
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Obtaining Certificates

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## Monitoring Setup

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'collab-editor'
    static_configs:
      - targets: ['server:3001']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import the provided dashboard or create custom panels:

- Request latency (p50, p95, p99)
- Active WebSocket connections
- Operations per second
- Error rate
- Database connection status

### Alerting Rules

```yaml
# alerts.yml
groups:
  - name: collab-editor
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
      
      - alert: DatabaseDown
        expr: mongodb_connection_status == 0
        for: 1m
        annotations:
          summary: "MongoDB connection lost"
```

---

## Backup Strategy

### MongoDB Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"

mongodump \
  --uri="mongodb://username:password@localhost:27017/collaborative_editor" \
  --out="$BACKUP_DIR/$DATE"

# Compress backup
tar -czf "$BACKUP_DIR/$DATE.tar.gz" "$BACKUP_DIR/$DATE"
rm -rf "$BACKUP_DIR/$DATE"

# Upload to S3
aws s3 cp "$BACKUP_DIR/$DATE.tar.gz" s3://your-backup-bucket/mongodb/

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

### Redis Backups

Redis automatically creates snapshots with AOF enabled. Copy RDB/AOF files:

```bash
# Backup Redis data
cp /var/lib/redis/dump.rdb /backups/redis/dump_$(date +%Y%m%d).rdb
```

---

## Scaling Considerations

### Horizontal Scaling

- Deploy multiple server instances behind load balancer
- Use Redis pub/sub for cross-server communication
- Enable sticky sessions for WebSocket connections
- Scale MongoDB with replica sets and sharding

### Vertical Scaling

- Increase CPU/memory for server containers
- Optimize MongoDB indexes and queries
- Tune Redis memory limits
- Enable connection pooling

### Load Balancing

Configure load balancer for WebSocket support:

```nginx
upstream backend {
    ip_hash;  # Sticky sessions
    server server1:3001;
    server server2:3001;
    server server3:3001;
}
```

---

## Security Hardening

### Application Security

- Use environment variables for secrets
- Enable rate limiting
- Implement input validation
- Use security headers (helmet)
- Enable CORS with specific origins
- Sanitize user input
- Use parameterized queries

### Network Security

- Use private networks for backend services
- Enable firewall rules
- Use VPN for database access
- Implement DDoS protection
- Use WAF (Web Application Firewall)

### Database Security

- Enable authentication
- Use strong passwords
- Limit network access
- Enable encryption at rest
- Enable encryption in transit
- Regular security updates

---

## Rollback Procedures

### Docker Rollback

```bash
# Rollback to previous version
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --scale server=3 \
  --build --force-recreate
```

### Kubernetes Rollback

```bash
# Rollback deployment
kubectl rollout undo deployment/collab-editor-server -n collab-editor

# Rollback to specific revision
kubectl rollout undo deployment/collab-editor-server --to-revision=2 -n collab-editor

# Check rollout status
kubectl rollout status deployment/collab-editor-server -n collab-editor
```

### Database Rollback

```bash
# Restore from backup
mongorestore \
  --uri="mongodb://username:password@localhost:27017/collaborative_editor" \
  --drop \
  /backups/mongodb/20250116_120000
```

---

## Post-Deployment Verification

### Smoke Tests

```bash
# Health checks
curl https://yourdomain.com/health/ready

# API test
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# WebSocket test
wscat -c wss://yourdomain.com?token=YOUR_TOKEN&documentId=DOC_ID
```

### Monitoring Checks

- Verify metrics are being collected
- Check error rates are normal
- Verify all services are healthy
- Check database connections
- Monitor resource usage

---

## Support and Maintenance

### Regular Maintenance Tasks

- Review and rotate logs
- Update dependencies
- Apply security patches
- Review and optimize database indexes
- Monitor and optimize performance
- Review and update documentation

### Incident Response

1. Identify the issue
2. Check monitoring and logs
3. Assess impact and severity
4. Implement fix or rollback
5. Verify resolution
6. Document incident and lessons learned

---

## Additional Resources

- [API Documentation](./API.md)
- [WebSocket Protocol](./WEBSOCKET.md)
- [Main README](../README.md)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
