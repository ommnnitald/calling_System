import { Router, Response } from 'express';
import { CallRecord } from '../models/CallRecord.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getDbStatus, isDbConnected } from '../db.js';
import { fallbackStore } from '../utils/fallbackStore.js';

export const callRouter = Router();

// Get call history for authenticated user
callRouter.get('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    if (isDbConnected()) {
      const queryOr: any[] = [{ hostUserId: userId }, { 'participants.userId': userId }];
      if (userName && userName.trim()) {
        queryOr.push({ hostName: userName.trim() });
        queryOr.push({ 'participants.displayName': userName.trim() });
      }

      const calls = await CallRecord.find({ $or: queryOr })
        .sort({ startedAt: -1 })
        .limit(50)
        .lean();

      const formattedCalls = calls.map((c: any) => ({
        id: c._id.toString(),
        roomId: c.roomId,
        hostName: c.hostName,
        hostUserId: c.hostUserId,
        isHost: c.hostUserId === userId || (userName ? c.hostName === userName : false),
        status: c.status,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        durationSeconds: c.durationSeconds || 0,
        maxConcurrentPeers: c.maxConcurrentPeers || c.participants?.length || 1,
        participantCount: c.participants?.length || 1,
        participants: (c.participants || []).map((p: any) => {
          const joined = p.joinedAt ? new Date(p.joinedAt).getTime() : new Date(c.startedAt).getTime();
          const left = p.leftAt ? new Date(p.leftAt).getTime() : (c.endedAt ? new Date(c.endedAt).getTime() : Date.now());
          const staySeconds = Math.max(0, Math.round((left - joined) / 1000));
          return {
            displayName: p.displayName,
            userId: p.userId,
            joinedAt: p.joinedAt,
            leftAt: p.leftAt || (c.status === 'completed' ? c.endedAt : undefined),
            staySeconds,
            isSelf: p.userId === userId || (userName ? p.displayName === userName : false),
            isHost: p.userId === c.hostUserId || p.displayName === c.hostName,
          };
        }),
      }));

      return res.json({
        success: true,
        calls: formattedCalls,
        databaseMode: 'mongodb',
      });
    } else {
      // Return calls from persistent local store
      const calls = fallbackStore.getCallsForUser(userId, userName);
      return res.json({
        success: true,
        calls,
        databaseMode: 'local-persistent',
      });
    }
  } catch (err: any) {
    console.error('[Call History Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch call history.',
    });
  }
});

// Get call stats for authenticated user
callRouter.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    if (isDbConnected()) {
      const queryOr: any[] = [{ hostUserId: userId }, { 'participants.userId': userId }];
      if (userName && userName.trim()) {
        queryOr.push({ hostName: userName.trim() });
        queryOr.push({ 'participants.displayName': userName.trim() });
      }

      const calls = await CallRecord.find({ $or: queryOr })
        .sort({ startedAt: -1 })
        .limit(100)
        .lean();

      const totalCalls = calls.length;
      const totalSeconds = calls.reduce((acc, c: any) => acc + (c.durationSeconds || 0), 0);
      const totalMinutes = Math.round(totalSeconds / 60);
      const hostedCount = calls.filter((c: any) => c.hostUserId === userId || (userName && c.hostName === userName)).length;

      // Distinct recent room IDs
      const seenRooms = new Set<string>();
      const recentRooms: string[] = [];
      for (const c of calls) {
        if (!seenRooms.has(c.roomId)) {
          seenRooms.add(c.roomId);
          recentRooms.push(c.roomId);
          if (recentRooms.length >= 5) break;
        }
      }

      return res.json({
        success: true,
        stats: {
          totalCalls,
          totalMinutes,
          hostedCount,
          recentRooms,
        },
        databaseMode: 'mongodb',
      });
    } else {
      const stats = fallbackStore.getStatsForUser(userId, userName);
      return res.json({
        success: true,
        stats,
        databaseMode: 'local-persistent',
      });
    }
  } catch (err: any) {
    console.error('[Call Stats Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to calculate call statistics.',
    });
  }
});
