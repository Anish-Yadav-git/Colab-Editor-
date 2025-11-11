import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocumentPermission {
  userId: mongoose.Types.ObjectId;
  role: 'owner' | 'editor' | 'viewer';
}

export interface IDocument extends MongooseDocument {
  title: string;
  ownerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  lastSnapshotAt?: Date;
  snapshotData?: Buffer;
  permissions: IDocumentPermission[];
  metadata: {
    characterCount: number;
    operationCount: number;
    activeUsers: number;
  };
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IDocumentModel extends mongoose.Model<IDocument> {
  createDocument(
    title: string,
    ownerId: mongoose.Types.ObjectId
  ): Promise<IDocument>;
  findByIdWithPermissions(
    documentId: string,
    userId: mongoose.Types.ObjectId
  ): Promise<IDocument | null>;
  updateMetadata(
    documentId: string,
    updates: Partial<IDocument['metadata']>
  ): Promise<IDocument | null>;
  softDelete(documentId: string): Promise<IDocument | null>;
}

const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lastSnapshotAt: {
      type: Date,
    },
    snapshotData: {
      type: Buffer,
    },
    permissions: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['owner', 'editor', 'viewer'],
          required: true,
        },
      },
    ],
    metadata: {
      characterCount: {
        type: Number,
        default: 0,
      },
      operationCount: {
        type: Number,
        default: 0,
      },
      activeUsers: {
        type: Number,
        default: 0,
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performance
documentSchema.index({ ownerId: 1, createdAt: -1 });
documentSchema.index({ 'permissions.userId': 1 });
documentSchema.index({ isDeleted: 1, updatedAt: -1 });

// Static method to create a new document
documentSchema.statics.createDocument = async function (
  title: string,
  ownerId: mongoose.Types.ObjectId
): Promise<IDocument> {
  const document = new this({
    title,
    ownerId,
    permissions: [
      {
        userId: ownerId,
        role: 'owner',
      },
    ],
    metadata: {
      characterCount: 0,
      operationCount: 0,
      activeUsers: 0,
    },
  });

  return document.save();
};

// Static method to find document by ID with permission check
documentSchema.statics.findByIdWithPermissions = async function (
  documentId: string,
  userId: mongoose.Types.ObjectId
): Promise<IDocument | null> {
  return this.findOne({
    _id: documentId,
    isDeleted: false,
    $or: [
      { ownerId: userId },
      { 'permissions.userId': userId },
    ],
  });
};

// Static method to update document metadata
documentSchema.statics.updateMetadata = async function (
  documentId: string,
  updates: Partial<IDocument['metadata']>
): Promise<IDocument | null> {
  return this.findByIdAndUpdate(
    documentId,
    {
      $set: {
        'metadata.characterCount': updates.characterCount,
        'metadata.operationCount': updates.operationCount,
        'metadata.activeUsers': updates.activeUsers,
      },
    },
    { new: true }
  );
};

// Static method to soft delete a document
documentSchema.statics.softDelete = async function (
  documentId: string
): Promise<IDocument | null> {
  return this.findByIdAndUpdate(
    documentId,
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    },
    { new: true }
  );
};

export const Document = mongoose.model<IDocument, IDocumentModel>(
  'Document',
  documentSchema
);
