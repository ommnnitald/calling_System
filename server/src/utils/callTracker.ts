import { CallRecord } from '../models/CallRecord.js';
import { isDbConnected } from '../db.js';
import { fallbackStore } from './fallbackStore.js';

/**
 * Non-blocking helper to log when a user enters a room into MongoDB or FallbackStore.
 */
export async function trackUserJoined(
  roomId: string,
  socketId: string,
  displayName: string,
  userId?: string
) {
  try {
    if (isDbConnected()) {
      let activeCall = await CallRecord.findOne({
        roomId,
        status: 'active',
      });

      if (!activeCall) {
        activeCall = new CallRecord({
          roomId,
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
        });
        await activeCall.save();
      } else {
        const existingParticipant = activeCall.participants.find(
          (p) => p.socketId === socketId
        );

        if (!existingParticipant) {
          activeCall.participants.push({
            userId,
            socketId,
            displayName,
            joinedAt: new Date(),
          });
        }

        if (!activeCall.hostUserId && userId) {
          activeCall.hostUserId = userId;
          activeCall.hostName = displayName;
        }

        activeCall.maxConcurrentPeers = Math.max(
          activeCall.maxConcurrentPeers,
          activeCall.participants.length
        );

        await activeCall.save();
      }
    } else {
      fallbackStore.trackJoin(roomId, socketId, displayName, userId);
    }
  } catch (err: any) {
    console.debug('[CallTracker] Error logging join:', err.message);
  }
}

/**
 * Non-blocking helper to log when a user leaves a room into MongoDB or FallbackStore.
 */
export async function trackUserLeft(
  roomId: string,
  socketId: string,
  remainingCount: number
) {
  try {
    if (isDbConnected()) {
      const activeCall = await CallRecord.findOne({
        roomId,
        status: 'active',
      });

      if (!activeCall) return;

      const participant = activeCall.participants.find((p) => p.socketId === socketId);
      if (participant) {
        participant.leftAt = new Date();
      }

      if (remainingCount === 0) {
        activeCall.status = 'completed';
        activeCall.endedAt = new Date();
        const started = activeCall.startedAt.getTime();
        const ended = activeCall.endedAt.getTime();
        activeCall.durationSeconds = Math.max(0, Math.round((ended - started) / 1000));
      }

      await activeCall.save();
    } else {
      fallbackStore.trackLeave(roomId, socketId, remainingCount);
    }
  } catch (err: any) {
    console.debug('[CallTracker] Error logging leave:', err.message);
  }
}
