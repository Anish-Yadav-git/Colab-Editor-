import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis configuration and client management
 * Provides publisher and subscriber clients for pub/sub functionality
 */
class RedisService {
  private static instance: RedisService;
  private publisherClient: RedisClientType | null = null;
  private subscriberClient: RedisClientType | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 1000; // 1 second
  private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Initialize Redis clients with error handling
   */
  async connect(): Promise<void> {
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
      const redisPassword = process.env.REDIS_PASSWORD || undefined;

      const redisConfig = {
        socket: {
          host: redisHost,
          port: redisPort,
          reconnectStrategy: (retries: number) => {
            return this.getReconnectDelay(retries);
          },
        },
        password: redisPassword,
      };

      // Create publisher client
      this.publisherClient = createClient(redisConfig);

      // Set up error handlers
      this.publisherClient.on('error', (error) => {
        console.error('Redis Publisher Error:', error.message);
        this.isConnected = false;
      });

      this.publisherClient.on('connect', () => {
        console.log('Redis Publisher connected');
      });

      this.publisherClient.on('ready', () => {
        console.log('Redis Publisher ready');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.publisherClient.on('reconnecting', () => {
        this.reconnectAttempts++;
        console.log(`Redis Publisher reconnecting (attempt ${this.reconnectAttempts})...`);
      });

      // Create subscriber client (separate client required for pub/sub)
      this.subscriberClient = createClient(redisConfig);

      this.subscriberClient.on('error', (error) => {
        console.error('Redis Subscriber Error:', error.message);
        this.isConnected = false;
      });

      this.subscriberClient.on('connect', () => {
        console.log('Redis Subscriber connected');
      });

      this.subscriberClient.on('ready', () => {
        console.log('Redis Subscriber ready');
      });

      this.subscriberClient.on('reconnecting', () => {
        console.log('Redis Subscriber reconnecting...');
      });

      // Connect both clients
      await Promise.all([this.publisherClient.connect(), this.subscriberClient.connect()]);

      console.log('Redis clients initialized successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Calculate reconnection delay with exponential backoff
   */
  private getReconnectDelay(retries: number): number {
    if (retries > this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max Redis reconnection attempts reached. Falling back to single-server mode.');
      return -1; // Stop reconnecting
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, retries - 1),
      this.MAX_RECONNECT_DELAY
    );

    console.log(`Redis reconnection delay: ${delay}ms`);
    return delay;
  }

  /**
   * Check if Redis is connected and available
   */
  isAvailable(): boolean {
    return (
      this.isConnected &&
      this.publisherClient !== null &&
      this.subscriberClient !== null &&
      this.publisherClient.isOpen &&
      this.subscriberClient.isOpen
    );
  }

  /**
   * Check if Redis is connected (for health checks)
   */
  getConnectionStatus(): boolean {
    return this.isAvailable();
  }

  /**
   * Get the publisher client
   */
  getPublisher(): RedisClientType | null {
    return this.publisherClient;
  }

  /**
   * Get the subscriber client
   */
  getSubscriber(): RedisClientType | null {
    return this.subscriberClient;
  }

  /**
   * Publish a message to a channel
   * Channel naming convention: room:{documentId}
   */
  async publish(channel: string, message: string): Promise<void> {
    if (!this.isAvailable() || !this.publisherClient) {
      console.warn('Redis not available, skipping publish');
      return;
    }

    try {
      await this.publisherClient.publish(channel, message);
    } catch (error) {
      console.error(`Error publishing to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a channel
   * Channel naming convention: room:{documentId}
   */
  async subscribe(
    channel: string,
    callback: (message: string, channel: string) => void
  ): Promise<void> {
    if (!this.isAvailable() || !this.subscriberClient) {
      console.warn('Redis not available, skipping subscribe');
      return;
    }

    try {
      await this.subscriberClient.subscribe(channel, callback);
      console.log(`Subscribed to Redis channel: ${channel}`);
    } catch (error) {
      console.error(`Error subscribing to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriberClient) {
      return;
    }

    try {
      await this.subscriberClient.unsubscribe(channel);
      console.log(`Unsubscribed from Redis channel: ${channel}`);
    } catch (error) {
      console.error(`Error unsubscribing from channel ${channel}:`, error);
    }
  }

  /**
   * Get channel name for a document room
   */
  static getChannelName(documentId: string): string {
    return `room:${documentId}`;
  }

  /**
   * Disconnect Redis clients
   */
  async disconnect(): Promise<void> {
    console.log('Disconnecting Redis clients...');

    try {
      if (this.publisherClient) {
        await this.publisherClient.quit();
        this.publisherClient = null;
      }

      if (this.subscriberClient) {
        await this.subscriberClient.quit();
        this.subscriberClient = null;
      }

      this.isConnected = false;
      console.log('Redis clients disconnected');
    } catch (error) {
      console.error('Error disconnecting Redis clients:', error);
    }
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    RedisService.instance = new RedisService();
  }
}

// Export singleton instance
export const redisService = RedisService.getInstance();
export { RedisService };
