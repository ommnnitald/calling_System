import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRecording extends Document {
  roomId: string;
  hostUserId?: string;
  hostName: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecordingSchema = new Schema<IRecording>(
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
      default: 'Host',
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: 'video/webm',
    },
  },
  {
    timestamps: true,
  }
);

export const Recording: Model<IRecording> =
  mongoose.models.Recording || mongoose.model<IRecording>('Recording', RecordingSchema);
