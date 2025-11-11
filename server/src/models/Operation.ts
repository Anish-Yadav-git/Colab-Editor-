import mongoose, { Schema, Document } from 'mongoose';

export interface IOperation extends Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  timestamp: Date;
  operationType: 'insert' | 'delete' | 'format';
  yjsUpdate: Buffer;
  vectorClock: Map<string, number>;
  metadata: {
    clientId: string;
    sessionId: string;
  };
}

export interface IOperationModel extends mongoose.Model<IOperation> {
  appendOperation(
    documentId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    operationType: 'insert' | 'delete' | 'format',
    yjsUpdate: Buffer,
    clientId: string,
    sessionId: string,
    vectorClock?: Map<string, number>
  ): Promise<IOperation>;
  findSince(
    documentId: mongoose.Types.ObjectId,
    since: Date
  ): Promise<IOperation[]>;
  compactOperations(
    documentId: mongoose.Types.ObjectId,
    beforeDate: Date
  ): Promise<number>;
}

const operationSchema = new Schema<IOperation>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    operationType: {
      type: String,
      enum: ['insert', 'delete', 'format'],
      required: true,
    },
    yjsUpdate: {
      type: Buffer,
      required: true,
    },
    vectorClock: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    metadata: {
      clientId: {
        type: String,
        required: true,
      },
      sessionId: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for efficient querying by document and timestamp
operationSchema.index({ documentId: 1, timestamp: -1 });
operationSchema.index({ documentId: 1, timestamp: 1 });

// TTL index for automatic deletion of old operations (30 days)
operationSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 2592000 }
);

// Static method to append a new operation
operationSchema.statics.appendOperation = async function (
  documentId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  operationType: 'insert' | 'delete' | 'format',
  yjsUpdate: Buffer,
  clientId: string,
  sessionId: string,
  vectorClock?: Map<string, number>
): Promise<IOperation> {
  const operation = new this({
    documentId,
    userId,
    operationType,
    yjsUpdate,
    vectorClock: vectorClock || new Map(),
    metadata: {
      clientId,
      sessionId,
    },
    timestamp: new Date(),
  });

  return operation.save();
};

// Static method to find operations since a timestamp
operationSchema.statics.findSince = async function (
  documentId: mongoose.Types.ObjectId,
  since: Date
): Promise<IOperation[]> {
  return this.find({
    documentId,
    timestamp: { $gte: since },
  }).sort({ timestamp: 1 });
};

// Static method to compact operations before a date
operationSchema.statics.compactOperations = async function (
  documentId: mongoose.Types.ObjectId,
  beforeDate: Date
): Promise<number> {
  const result = await this.deleteMany({
    documentId,
    timestamp: { $lt: beforeDate },
  });

  return result.deletedCount || 0;
};

export const Operation = mongoose.model<IOperation, IOperationModel>(
  'Operation',
  operationSchema
);
