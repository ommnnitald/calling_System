import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IParticipantRecord {
  userId?: string;
  socketId?: string;
  displayName: string;
  joinedAt: Date;
  leftAt?: Date;
}

export interface ICallRecord extends Document {
  roomId: string;
  hostUserId?: string;
  hostName: string;
  participants: IParticipantRecord[];
  status: 'active' | 'completed';
  startedAt: Date;
  endedAt?: Date;
  durationSeconds: number;
  maxConcurrentPeers: number;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantRecordSchema = new Schema<IParticipantRecord>(
  {
    userId: { type: String, ref: 'User' },
    socketId: { type: String },
    displayName: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
  },
  { _id: false }
);

const CallRecordSchema = new Schema<ICallRecord>(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    hostUserId: {
      type: String,
      ref: 'User',
      index: true,
    },
    hostName: {
      type: String,
      default: 'Anonymous',
    },
    participants: [ParticipantRecordSchema],
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    maxConcurrentPeers: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

export const CallRecord: Model<ICallRecord> =
  mongoose.models.CallRecord || mongoose.model<ICallRecord>('CallRecord', CallRecordSchema);
