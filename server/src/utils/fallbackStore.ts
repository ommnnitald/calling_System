import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// Resolve persistent storage path (supports running from root or from server/)
const DATA_DIR = fs.existsSync(path.resolve(process.cwd(), 'server'))
  ? path.resolve(process.cwd(), 'server', 'data')
  : path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'streamcall-store.json');

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  createdAt: Date;
}

export interface StoredUser extends SafeUser {
  passwordHash: string;
}

export interface ParticipantRecord {
  userId?: string;
  socketId: string;
  displayName: string;
  joinedAt: Date;
  leftAt?: Date;
}

export interface StoredCallRecord {
  id: string;
  roomId: string;
  hostUserId?: string;
  hostName: string;
  participants: ParticipantRecord[];
  status: 'active' | 'completed' | 'abandoned';
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  maxConcurrentPeers: number;
}

export interface StoredRecording {
  id: string;
  roomId: string;
  hostUserId?: string;
  hostName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  durationSeconds: number;
  mimeType: string;
  createdAt: Date;
}

const AVATAR_COLORS = [
  'from-emerald-500 to-teal-500',
  'from-indigo-500 to-purple-500',
  'from-amber-500 to-orange-500',
  'from-cyan-500 to-blue-500',
  'from-fuchsia-500 to-pink-500',
];

class PersistentFallbackStore {
  private users = new Map<string, StoredUser>(); // keyed by clean email
  private usersById = new Map<string, StoredUser>(); // keyed by id
  private calls = new Map<string, StoredCallRecord>(); // keyed by call id or active room
  private activeRoomCalls = new Map<string, string>(); // roomId -> callId
  private recordings = new Map<string, StoredRecording>(); // keyed by recording id

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.users && Array.isArray(data.users)) {
          for (const u of data.users) {
            u.createdAt = new Date(u.createdAt);
            this.users.set(u.email, u);
            this.usersById.set(u.id, u);
          }
        }
        if (data.calls && Array.isArray(data.calls)) {
          for (const c of data.calls) {
            c.startedAt = new Date(c.startedAt);
            if (c.endedAt) c.endedAt = new Date(c.endedAt);
            if (c.participants) {
              c.participants = c.participants.map((p: any) => ({
                ...p,
                joinedAt: new Date(p.joinedAt),
                leftAt: p.leftAt ? new Date(p.leftAt) : undefined,
              }));
            }
            this.calls.set(c.id, c);
            if (c.status === 'active') {
              this.activeRoomCalls.set(c.roomId, c.id);
            }
          }
        }
        if (data.recordings && Array.isArray(data.recordings)) {
          for (const r of data.recordings) {
            r.createdAt = new Date(r.createdAt);
            this.recordings.set(r.id, r);
          }
        }
        console.log(`[Persistent Store] Loaded ${this.users.size} users, ${this.calls.size} calls, and ${this.recordings.size} recordings from ${STORE_PATH}`);
      }
    } catch (err: any) {
      console.warn('[Persistent Store] Notice reading store file:', err.message);
    }
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        updatedAt: new Date().toISOString(),
        users: Array.from(this.usersById.values()),
        calls: Array.from(this.calls.values()),
        recordings: Array.from(this.recordings.values()),
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[Persistent Store] Error writing store file:', err.message);
    }
  }

  async createUser(name: string, email: string, passwordPlain: string): Promise<SafeUser> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (this.users.has(cleanEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);
    const id = `mem-usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const user: StoredUser = {
      id,
      name: cleanName,
      email: cleanEmail,
      avatarColor,
      createdAt: new Date(),
      passwordHash,
    };

    this.users.set(cleanEmail, user);
    this.usersById.set(id, user);
    this.saveToDisk();

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
    };
  }

  async authenticateUser(email: string, passwordPlain: string): Promise<SafeUser | null> {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.users.get(cleanEmail);
    if (!user) return null;

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
    };
  }

  getUserById(id: string): SafeUser | null {
    const user = this.usersById.get(id);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
    };
  }

  updateProfile(id: string, name?: string, avatarColor?: string): SafeUser | null {
    const user = this.usersById.get(id);
    if (!user) return null;

    if (name && name.trim()) {
      user.name = name.trim().substring(0, 50);
    }
    if (avatarColor) {
      user.avatarColor = avatarColor;
    }

    this.saveToDisk();

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
    };
  }

  // Call tracking methods
  trackJoin(roomId: string, socketId: string, displayName: string, userId?: string): StoredCallRecord {
    const cleanRoom = roomId.trim();
    let callId = this.activeRoomCalls.get(cleanRoom);
    let call = callId ? this.calls.get(callId) : null;

    if (!call || call.status !== 'active') {
      callId = `mem-call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      call = {
        id: callId,
        roomId: cleanRoom,
        hostUserId: userId,
        hostName: displayName,
        participants: [
          {
            userId,
            socketId,
            displayName,
            joinedAt: new Date(),
          },
        ],
        status: 'active',
        startedAt: new Date(),
        maxConcurrentPeers: 1,
      };
      this.calls.set(callId, call);
      this.activeRoomCalls.set(cleanRoom, callId);
    } else {
      const existing = call.participants.find((p) => p.socketId === socketId);
      if (!existing) {
        call.participants.push({
          userId,
          socketId,
          displayName,
          joinedAt: new Date(),
        });
      }
      if (!call.hostUserId && userId) {
        call.hostUserId = userId;
        call.hostName = displayName;
      }
      call.maxConcurrentPeers = Math.max(call.maxConcurrentPeers, call.participants.length);
    }

    this.saveToDisk();
    return call;
  }

  trackLeave(roomId: string, socketId: string, remainingCount: number): void {
    const cleanRoom = roomId.trim();
    const callId = this.activeRoomCalls.get(cleanRoom);
    if (!callId) return;

    const call = this.calls.get(callId);
    if (!call) return;

    const p = call.participants.find((part) => part.socketId === socketId);
    if (p) {
      p.leftAt = new Date();
    }

    if (remainingCount === 0) {
      call.status = 'completed';
      call.endedAt = new Date();
      call.durationSeconds = Math.max(0, Math.round((call.endedAt.getTime() - call.startedAt.getTime()) / 1000));
      this.activeRoomCalls.delete(cleanRoom);
    }

    this.saveToDisk();
  }

  getCallsForUser(userId: string, userName?: string): any[] {
    const cleanUserName = userName?.trim().toLowerCase();
    const userCalls = Array.from(this.calls.values())
      .filter((c) => {
        if (c.hostUserId === userId) return true;
        if (c.participants.some((p) => p.userId === userId)) return true;
        if (cleanUserName) {
          if (c.hostName && c.hostName.toLowerCase() === cleanUserName) return true;
          if (c.participants.some((p) => p.displayName && p.displayName.toLowerCase() === cleanUserName)) return true;
        }
        return false;
      })
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return userCalls.map((c) => ({
      id: c.id,
      roomId: c.roomId,
      hostName: c.hostName,
      hostUserId: c.hostUserId,
      isHost: c.hostUserId === userId || (cleanUserName ? c.hostName.toLowerCase() === cleanUserName : false),
      status: c.status,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      durationSeconds: c.durationSeconds || 0,
      maxConcurrentPeers: c.maxConcurrentPeers || c.participants.length,
      participantCount: c.participants.length,
      participants: c.participants.map((p) => {
        const joined = p.joinedAt ? new Date(p.joinedAt).getTime() : new Date(c.startedAt).getTime();
        const left = p.leftAt ? new Date(p.leftAt).getTime() : (c.endedAt ? new Date(c.endedAt).getTime() : Date.now());
        const staySeconds = Math.max(0, Math.round((left - joined) / 1000));
        return {
          displayName: p.displayName,
          userId: p.userId,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt || (c.status === 'completed' ? c.endedAt : undefined),
          staySeconds,
          isSelf: p.userId === userId || (cleanUserName ? p.displayName.toLowerCase() === cleanUserName : false),
          isHost: p.userId === c.hostUserId || p.displayName === c.hostName,
        };
      }),
    }));
  }

  getStatsForUser(userId: string, userName?: string): {
    totalCalls: number;
    totalMinutes: number;
    hostedCount: number;
    recentRooms: string[];
  } {
    const cleanUserName = userName?.trim().toLowerCase();
    const userCalls = Array.from(this.calls.values()).filter((c) => {
      if (c.hostUserId === userId) return true;
      if (c.participants.some((p) => p.userId === userId)) return true;
      if (cleanUserName) {
        if (c.hostName && c.hostName.toLowerCase() === cleanUserName) return true;
        if (c.participants.some((p) => p.displayName && p.displayName.toLowerCase() === cleanUserName)) return true;
      }
      return false;
    });

    const totalCalls = userCalls.length;
    const totalSeconds = userCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    const hostedCount = userCalls.filter((c) => c.hostUserId === userId || (cleanUserName && c.hostName.toLowerCase() === cleanUserName)).length;

    const seenRooms = new Set<string>();
    const recentRooms: string[] = [];
    for (const c of userCalls) {
      if (!seenRooms.has(c.roomId)) {
        seenRooms.add(c.roomId);
        recentRooms.push(c.roomId);
        if (recentRooms.length >= 5) break;
      }
    }

    return {
      totalCalls,
      totalMinutes,
      hostedCount,
      recentRooms,
    };
  }

  // Recording management methods
  saveRecording(rec: {
    roomId: string;
    hostUserId?: string;
    hostName: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    durationSeconds: number;
    mimeType: string;
  }): StoredRecording {
    const id = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const recording: StoredRecording = {
      id,
      ...rec,
      createdAt: new Date(),
    };
    this.recordings.set(id, recording);
    this.saveToDisk();
    return recording;
  }

  getRecordingById(id: string): StoredRecording | null {
    return this.recordings.get(id) || null;
  }

  getRecordingsForUser(userId: string, userName?: string): StoredRecording[] {
    const cleanName = userName?.trim().toLowerCase();
    return Array.from(this.recordings.values())
      .filter((r) => {
        if (r.hostUserId && r.hostUserId === userId) return true;
        if (cleanName && r.hostName && r.hostName.toLowerCase() === cleanName) return true;
        return false;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getRecordingsForRoom(roomId: string): StoredRecording[] {
    const cleanRoom = roomId.trim();
    return Array.from(this.recordings.values())
      .filter((r) => r.roomId === cleanRoom)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteRecording(id: string, userId?: string, userName?: string): boolean {
    const r = this.recordings.get(id);
    if (!r) return false;
    if (userId && r.hostUserId && r.hostUserId !== userId) {
      if (!userName || r.hostName.toLowerCase() !== userName.toLowerCase()) {
        return false;
      }
    }
    try {
      if (fs.existsSync(r.filePath)) {
        fs.unlinkSync(r.filePath);
      }
    } catch (err) {
      console.warn('[Persistent Store] Notice deleting recording file from disk:', err);
    }
    this.recordings.delete(id);
    this.saveToDisk();
    return true;
  }
}

export const fallbackStore = new PersistentFallbackStore();
