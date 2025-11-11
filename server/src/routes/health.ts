import { Router } from 'express';
import { liveness, readiness, metrics } from '../controllers/healthController.js';

const router = Router();

/**
 * GET /health/live
 * Liveness probe - checks if server is running
 */
router.get('/live', liveness);

/**
 * GET /health/ready
 * Readiness probe - checks if server is ready to accept traffic
 */
router.get('/ready', readiness);

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/metrics', metrics);

export default router;
