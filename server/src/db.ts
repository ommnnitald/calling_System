import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

export interface DbStatus {
  isConnected: boolean;
  mode: 'mongodb' | 'local-persistent';
  uri: string;
  error?: string;
  readyPromise?: Promise<boolean>;
}

const status: DbStatus = {
  isConnected: false,
  mode: 'local-persistent',
  uri: '',
};

let retryTimer: any = null;

export function getDbStatus(): DbStatus {
  const isConnected = mongoose.connection.readyState === 1;
  return {
    ...status,
    isConnected,
    mode: isConnected ? 'mongodb' : 'local-persistent',
  };
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// Automatically sync any local JSON store users/calls/recordings into MongoDB once connected
export async function syncLocalStoreToMongoDB(): Promise<void> {
  try {
    const storePath = fs.existsSync(path.resolve(process.cwd(), 'server', 'data', 'streamcall-store.json'))
      ? path.resolve(process.cwd(), 'server', 'data', 'streamcall-store.json')
      : path.resolve(process.cwd(), 'data', 'streamcall-store.json');

    if (!fs.existsSync(storePath)) return;

    const raw = fs.readFileSync(storePath, 'utf-8');
    const storeData = JSON.parse(raw);
    const db = mongoose.connection.db;
    if (!db) return;

    // Sync Users
    if (storeData.users && Array.isArray(storeData.users)) {
      const usersCol = db.collection('users');
      for (const u of storeData.users) {
        const existing = await usersCol.findOne({ email: u.email.toLowerCase() });
        if (!existing) {
          await usersCol.insertOne({
            name: u.name,
            email: u.email.toLowerCase(),
            password: u.passwordHash,
            avatarColor: u.avatarColor || 'from-emerald-500 to-teal-500',
            createdAt: new Date(u.createdAt || Date.now()),
            updatedAt: new Date(),
          });
          console.log(`[MongoDB Sync] Synchronized user: ${u.name} (${u.email})`);
        }
      }
    }

    // Sync Calls
    if (storeData.calls && Array.isArray(storeData.calls)) {
      const callsCol = db.collection('callrecords');
      for (const c of storeData.calls) {
        const existing = await callsCol.findOne({ roomId: c.roomId, startedAt: new Date(c.startedAt) });
        if (!existing) {
          await callsCol.insertOne({
            roomId: c.roomId,
            hostUserId: c.hostUserId,
            hostName: c.hostName || 'Host',
            participants: (c.participants || []).map((p: any) => ({
              userId: p.userId,
              socketId: p.socketId,
              displayName: p.displayName,
              joinedAt: new Date(p.joinedAt),
              leftAt: p.leftAt ? new Date(p.leftAt) : undefined,
            })),
            status: c.status || 'completed',
            startedAt: new Date(c.startedAt),
            endedAt: c.endedAt ? new Date(c.endedAt) : undefined,
            durationSeconds: c.durationSeconds || 0,
            maxConcurrentPeers: c.maxConcurrentPeers || 1,
            createdAt: new Date(c.startedAt || Date.now()),
            updatedAt: new Date(c.endedAt || Date.now()),
          });
        }
      }
    }

    // Sync Recordings
    if (storeData.recordings && Array.isArray(storeData.recordings)) {
      const recsCol = db.collection('recordings');
      for (const r of storeData.recordings) {
        const existing = await recsCol.findOne({ fileName: r.fileName });
        if (!existing) {
          await recsCol.insertOne({
            roomId: r.roomId,
            hostUserId: r.hostUserId,
            hostName: r.hostName || 'Host',
            fileName: r.fileName,
            fileSize: r.fileSize || 0,
            durationSeconds: r.durationSeconds || 0,
            mimeType: r.mimeType || 'video/webm',
            createdAt: new Date(r.createdAt || Date.now()),
            updatedAt: new Date(r.createdAt || Date.now()),
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[MongoDB Sync] Note during store migration:', err.message);
  }
}

export async function connectDatabase(): Promise<boolean> {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/streamcall';

  status.uri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'); // Mask password in logs

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000,
    });

    status.isConnected = true;
    status.error = undefined;
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    console.log(`[MongoDB] Connected successfully to ${status.uri}`);
    await syncLocalStoreToMongoDB();
    return true;
  } catch (err: any) {
    status.isConnected = false;
    status.error = err.message;
    console.warn(`[MongoDB] Connection notice: Unable to connect to MongoDB at ${status.uri} (${err.message}).`);
    console.warn(`[MongoDB] Using persistent local disk storage fallback. Retrying MongoDB in background...`);

    if (!retryTimer) {
      retryTimer = setInterval(async () => {
        try {
          if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
            status.isConnected = true;
            status.error = undefined;
            clearInterval(retryTimer);
            retryTimer = null;
            console.log(`[MongoDB] Reconnected successfully to ${status.uri}`);
            await syncLocalStoreToMongoDB();
          }
        } catch (_) {}
      }, 5000);
    }

    return false;
  }
}

mongoose.connection.on('connected', () => {
  status.isConnected = true;
  status.error = undefined;
  console.log('[MongoDB] Connection state: Connected');
});

mongoose.connection.on('disconnected', () => {
  status.isConnected = false;
  console.warn('[MongoDB] Connection state: Disconnected');
});

mongoose.connection.on('error', (err: any) => {
  status.isConnected = false;
  status.error = err.message;
  console.error('[MongoDB] Connection error:', err.message);
});
