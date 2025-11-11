import mongoose from 'mongoose';

interface ConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
}

class DatabaseConnection {
  private retryCount = 0;
  private maxRetries: number;
  private retryDelay: number;
  private isShuttingDown = false;

  constructor(options: ConnectionOptions = {}) {
    this.maxRetries = options.maxRetries || 5;
    this.retryDelay = options.retryDelay || 5000;
  }

  async connect(uri: string): Promise<void> {
    try {
      await mongoose.connect(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
      });

      console.log('MongoDB connected successfully');
      this.retryCount = 0;

      this.setupEventHandlers();
    } catch (error) {
      console.error('MongoDB connection error:', error);
      await this.handleConnectionError();
    }
  }

  private setupEventHandlers(): void {
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      if (!this.isShuttingDown) {
        this.handleConnectionError();
      }
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
      this.retryCount = 0;
    });
  }

  private async handleConnectionError(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(
        `Retrying MongoDB connection (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, this.retryDelay));

      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor';
      await this.connect(uri);
    } else {
      console.error('Max retry attempts reached. Could not connect to MongoDB.');
      process.exit(1);
    }
  }

  async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed gracefully');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }
}

export const dbConnection = new DatabaseConnection();

export const connectDatabase = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor';
  await dbConnection.connect(uri);
};

export const disconnectDatabase = async (): Promise<void> => {
  await dbConnection.disconnect();
};
