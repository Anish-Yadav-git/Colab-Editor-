import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  lastLoginAt?: Date;
  preferences: {
    editorTheme: string;
    cursorColor: string;
    avatarUrl?: string;
  };
  validatePassword(password: string): Promise<boolean>;
}

export interface IUserModel extends mongoose.Model<IUser> {
  createUser(email: string, password: string, name: string): Promise<IUser>;
  findByEmail(email: string): Promise<IUser | null>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    lastLoginAt: {
      type: Date,
    },
    preferences: {
      editorTheme: {
        type: String,
        default: 'light',
      },
      cursorColor: {
        type: String,
        default: '#000000',
      },
      avatarUrl: {
        type: String,
        default: undefined,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Instance method to validate password
userSchema.methods.validatePassword = async function (
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// Static method to create a new user
userSchema.statics.createUser = async function (
  email: string,
  password: string,
  name: string
): Promise<IUser> {
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const user = new this({
    email,
    passwordHash,
    name,
  });

  return user.save();
};

// Static method to find user by email
userSchema.statics.findByEmail = async function (
  email: string
): Promise<IUser | null> {
  return this.findOne({ email: email.toLowerCase() });
};

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
