# Redis Multi-Server Manual Testing Guide

## Prerequisites

1. Install Redis:
   ```bash
   # macOS
   brew install redis
   
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # Or use Docker
   docker run -d -p 6379:6379 redis:latest
   ```

2. Start Redis:
   ```bash
   redis-server
   ```

## Test Scenario 1: Single Server Mode (No Redis)

1. Stop Redis if running:
   ```bash
   redis-cli shutdown
   ```

2. Start the server:
   ```bash
   cd server
   npm run dev
   ```

3. Expected output:
   ```
   Redis connection failed - running in single-server mode: ...
   Server running on port 3001
   WebSocket server ready
   ```

4. ✅ Server should start successfully without Redis

## Test Scenario 2: Multi-Server Mode (With Redis)

1. Start Redis:
   ```bash
   redis-server
   ```

2. Start first server instance:
   ```bash
   cd server
   PORT=3001 npm run dev
   ```

3. Expected output:
   ```
   Redis Publisher connected
   Redis Subscriber connected
   Redis Publisher ready
   Redis Subscriber ready
   Redis clients initialized successfully
   Redis connected - multi-server mode enabled
   Server running on port 3001
   ```

4. Start second server instance (in new terminal):
   ```bash
   cd server
   PORT=3002 npm run dev
   ```

5. ✅ Both servers should connect to Redis successfully

## Test Scenario 3: Cross-Server Message Broadcasting

1. Start Redis and two server instances (ports 3001 and 3002)

2. Monitor Redis pub/sub activity:
   ```bash
   redis-cli
   > PSUBSCRIBE room:*
   ```

3. Connect a client to server 1 (port 3001) and create/edit a document

4. Connect another client to server 2 (port 3002) and join the same document

5. Make edits from both clients

6. Expected behavior:
   - ✅ Edits from client on server 1 appear on client on server 2
   - ✅ Edits from client on server 2 appear on client on server 1
   - ✅ Redis shows messages on channel `room:{documentId}`
   - ✅ Each server filters out its own messages (no echo)

## Test Scenario 4: Redis Reconnection

1. Start server with Redis running:
   ```bash
   npm run dev
   ```

2. Stop Redis:
   ```bash
   redis-cli shutdown
   ```

3. Expected output:
   ```
   Redis Publisher Error: ...
   Redis Subscriber Error: ...
   Redis Publisher reconnecting (attempt 1)...
   Redis reconnection delay: 1000ms
   ```

4. Restart Redis:
   ```bash
   redis-server
   ```

5. Expected output:
   ```
   Redis Publisher ready
   Redis Subscriber ready
   ```

6. ✅ Server should reconnect automatically

## Test Scenario 5: Graceful Degradation

1. Start server with Redis

2. Create a document and start editing

3. Stop Redis:
   ```bash
   redis-cli shutdown
   ```

4. Continue editing

5. Expected behavior:
   - ✅ Server continues to work
   - ✅ Local clients can still collaborate
   - ✅ No crashes or errors
   - ✅ Falls back to single-server mode
   - ✅ Logs warnings but continues operation

## Monitoring Redis Activity

### View all keys:
```bash
redis-cli
> KEYS *
```

### Monitor pub/sub channels:
```bash
redis-cli
> PUBSUB CHANNELS
```

### Subscribe to all room channels:
```bash
redis-cli
> PSUBSCRIBE room:*
```

### View message format:
```json
{
  "type": "update",
  "serverId": "a37c5d4c-84e7-4092-a75b-bf061b5fad9f",
  "update": "base64-encoded-data...",
  "timestamp": 1234567890
}
```

## Verification Checklist

- [ ] Server starts without Redis (single-server mode)
- [ ] Server starts with Redis (multi-server mode)
- [ ] Multiple servers can run simultaneously
- [ ] Messages are published to Redis channels
- [ ] Messages are received from Redis channels
- [ ] Server ID prevents message echo
- [ ] Redis reconnection works with exponential backoff
- [ ] Server continues to work when Redis fails
- [ ] Graceful shutdown unsubscribes from channels
- [ ] No memory leaks or connection leaks

## Troubleshooting

### Redis connection refused
- Check if Redis is running: `redis-cli ping`
- Check Redis port: default is 6379
- Check .env configuration

### Messages not crossing servers
- Verify both servers are connected to same Redis instance
- Check Redis logs: `redis-cli MONITOR`
- Verify channel names match: `room:{documentId}`

### High memory usage
- Check number of subscribed channels
- Verify channels are unsubscribed on room cleanup
- Monitor Redis memory: `redis-cli INFO memory`
