import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { redisService } from './config/redis.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import healthRoutes from './routes/health.js';
import { WebSocketServer } from './websocket/WebSocketServer.js';
import logger from './config/logger.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeRequestBody, validateRequestSize } from './middleware/inputSanitization.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);
const wsServer = new WebSocketServer();

// Correlation ID middleware (must be first)
app.use(correlationIdMiddleware);

// Request logging middleware
app.use(requestLoggerMiddleware);

// Metrics middleware
app.use(metricsMiddleware);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS origin rejected', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    exposedHeaders: ['X-Correlation-ID'],
    maxAge: 86400, // 24 hours
  })
);

// Rate limiting middleware (100 requests per minute per IP)
app.use('/api', apiLimiter);

// Request size validation (before body parsing)
app.use(validateRequestSize);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware (after body parsing)
app.use(sanitizeRequestBody);

// Health check and metrics routes (no auth required)
app.use('/health', healthRoutes);
app.get('/metrics', healthRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDatabase();
    logger.info('Database connected');

    // Initialize Redis (optional - server will fall back to single-server mode if unavailable)
    try {
      await redisService.connect();
      logger.info('Redis connected - multi-server mode enabled');
    } catch (error) {
      logger.warn('Redis connection failed - running in single-server mode', { error });
      // Continue without Redis - server will work in single-server mode
    }

    // Initialize WebSocket server
    wsServer.initialize(httpServer);
    logger.info('WebSocket server initialized');

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  httpServer.close(async () => {
    logger.info('HTTP server closed');

    try {
      await wsServer.shutdown();
      await redisService.disconnect();
      await disconnectDatabase();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
