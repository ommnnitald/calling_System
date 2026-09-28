import { Server, Socket } from 'socket.io';
import { RoomManager } from './roomManager.js';
import {
  JoinRoomPayload,
  OfferPayload,
  AnswerPayload,
  IceCandidatePayload,
  MediaTogglePayload,
  SendChatMessagePayload,
  ReactionPayload,
  ChatMessage,
  BroadcastReactionPayload,
} from './types.js';
import { trackUserJoined, trackUserLeft } from './utils/callTracker.js';

export function registerSocketHandlers(io: Server, roomManager: RoomManager) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    // Handle Join Room
    socket.on('join-room', (payload: JoinRoomPayload, callback?: (response: any) => void) => {
      try {
        const { roomId, displayName, isAudioMuted, isVideoMuted, userId } = payload || {};
        if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
          const err = { success: false, message: 'Invalid or missing roomId.' };
          if (callback) callback(err);
          socket.emit('error-message', err);
          return;
        }

        const joinResult = roomManager.joinRoom(
          roomId,
          socket.id,
          displayName || 'Anonymous',
          Boolean(isAudioMuted),
          Boolean(isVideoMuted),
          userId
        );

        if (!joinResult.success) {
          const failureData = {
            success: false,
            reason: joinResult.reason,
            message: joinResult.message,
          };
          console.log(`[Join Rejected] Socket: ${socket.id} -> Room: ${roomId} Reason: ${joinResult.reason}`);
          if (callback) callback(failureData);
          if (joinResult.reason === 'room_full') {
            socket.emit('room-full', failureData);
          } else {
            socket.emit('error-message', failureData);
          }
          return;
        }

        const cleanRoomId = roomId.trim();
        // Join the Socket.IO room channel
        socket.join(cleanRoomId);

        // Record participant joining call in MongoDB
        trackUserJoined(cleanRoomId, socket.id, joinResult.self?.displayName || 'Anonymous', userId);

        const successData = {
          success: true,
          roomId: cleanRoomId,
          self: joinResult.self,
          otherParticipants: joinResult.otherParticipants,
          isHost: joinResult.isHost || false,
          hostSocketId: joinResult.hostSocketId || '',
        };

        console.log(
          `[Room Joined] Socket: ${socket.id} (${joinResult.self?.displayName}) -> Room: "${cleanRoomId}" [Host: ${joinResult.isHost}] (Total peers: ${(joinResult.otherParticipants?.length || 0) + 1})`
        );

        if (callback) callback(successData);
        socket.emit('room-joined', successData);

        // Notify other participants in the room
        socket.to(cleanRoomId).emit('user-joined', {
          participant: joinResult.self,
        });
      } catch (err: any) {
        console.error('[Error in join-room handler]:', err);
        socket.emit('error-message', { success: false, message: 'Internal server error while joining room.' });
      }
    });

    // Handle WebRTC Offer
    socket.on('offer', (payload: OfferPayload) => {
      try {
        const { to, sdp } = payload || {};
        if (!to || typeof to !== 'string' || !sdp || typeof sdp !== 'object') {
          return;
        }
        // Verify sender and recipient are in the same room
        if (!roomManager.arePeersInSameRoom(socket.id, to)) {
          console.warn(`[Security] Rejected offer: ${socket.id} and ${to} are not in the same room`);
          return;
        }

        const sender = roomManager.getParticipant(socket.id);
        console.log(`[WebRTC Offer] From: ${socket.id} (${sender?.displayName}) -> To: ${to}`);
        io.to(to).emit('offer', {
          from: socket.id,
          senderName: sender?.displayName || 'Peer',
          sdp,
        });
      } catch (err) {
        console.error('[Error in offer handler]:', err);
      }
    });

    // Handle WebRTC Answer
    socket.on('answer', (payload: AnswerPayload) => {
      try {
        const { to, sdp } = payload || {};
        if (!to || typeof to !== 'string' || !sdp || typeof sdp !== 'object') {
          return;
        }
        // Verify sender and recipient are in the same room
        if (!roomManager.arePeersInSameRoom(socket.id, to)) {
          console.warn(`[Security] Rejected answer: ${socket.id} and ${to} are not in the same room`);
          return;
        }

        console.log(`[WebRTC Answer] From: ${socket.id} -> To: ${to}`);
        io.to(to).emit('answer', {
          from: socket.id,
          sdp,
        });
      } catch (err) {
        console.error('[Error in answer handler]:', err);
      }
    });

    // Handle ICE Candidate
    socket.on('ice-candidate', (payload: IceCandidatePayload) => {
      try {
        const { to, candidate } = payload || {};
        if (!to || typeof to !== 'string' || !candidate) {
          return;
        }
        // Verify sender and recipient are in the same room
        if (!roomManager.arePeersInSameRoom(socket.id, to)) {
          return;
        }

        io.to(to).emit('ice-candidate', {
          from: socket.id,
          candidate,
        });
      } catch (err) {
        console.error('[Error in ice-candidate handler]:', err);
      }
    });

    // Handle real-time microphone or camera toggle
    socket.on('media-toggle', (payload: MediaTogglePayload) => {
      try {
        const { type, isMuted } = payload || {};
        if (type !== 'audio' && type !== 'video') return;

        const res = roomManager.updateParticipantMedia(socket.id, type, Boolean(isMuted));
        if (res.roomId) {
          console.log(
            `[Media Toggle] Socket: ${socket.id} (${res.participant?.displayName}) -> Room: "${res.roomId}" ${type} muted: ${isMuted}`
          );
          // Broadcast to all other peers in the room
          socket.to(res.roomId).emit('peer-media-toggled', {
            socketId: socket.id,
            type,
            isMuted: Boolean(isMuted),
          });
        }
      } catch (err) {
        console.error('[Error in media-toggle handler]:', err);
      }
    });

    // Handle in-call text chat message
    socket.on('chat-message', (payload: SendChatMessagePayload, callback?: (res: any) => void) => {
      try {
        const text = (payload?.text || '').trim();
        if (!text) return;

        const roomId = roomManager.getRoomIdForSocket(socket.id);
        if (!roomId) {
          if (callback) callback({ success: false, message: 'Not in a room.' });
          return;
        }

        const participant = roomManager.getParticipant(socket.id);
        const message: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          senderId: socket.id,
          senderName: participant?.displayName || 'Anonymous',
          text: text.substring(0, 1000),
          timestamp: Date.now(),
        };

        console.log(`[Chat Message] Socket: ${socket.id} (${message.senderName}) -> Room: "${roomId}": "${message.text}"`);
        io.to(roomId).emit('chat-message', message);
        if (callback) callback({ success: true, message });
      } catch (err) {
        console.error('[Error in chat-message handler]:', err);
      }
    });

    // Handle floating emoji reactions
    socket.on('call-reaction', (payload: ReactionPayload) => {
      try {
        const emoji = (payload?.emoji || '').trim();
        if (!emoji) return;

        const roomId = roomManager.getRoomIdForSocket(socket.id);
        if (!roomId) return;

        const participant = roomManager.getParticipant(socket.id);
        const reaction: BroadcastReactionPayload = {
          id: `react-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          senderId: socket.id,
          senderName: participant?.displayName || 'Anonymous',
          emoji,
          timestamp: Date.now(),
        };

        io.to(roomId).emit('call-reaction', reaction);
      } catch (err) {
        console.error('[Error in call-reaction handler]:', err);
      }
    });

    // Handle Meeting Recording broadcast (MS Teams style) - HOST ONLY
    socket.on('start-recording', (payload?: { hostName?: string }) => {
      try {
        const roomId = roomManager.getRoomIdForSocket(socket.id);
        if (!roomId) return;

        // Security check: Only the meeting host can initiate recording
        if (!roomManager.isHost(socket.id)) {
          console.warn(`[Security] Rejected start-recording: Socket ${socket.id} is not the host of room "${roomId}"`);
          socket.emit('recording-error', { message: 'Only the meeting host can record this meeting.' });
          return;
        }

        const participant = roomManager.getParticipant(socket.id);
        const hostName = payload?.hostName || participant?.displayName || 'Host';

        console.log(`[Recording Started] Host Socket: ${socket.id} (${hostName}) in Room: "${roomId}"`);
        io.to(roomId).emit('recording-started', {
          hostName,
          hostSocketId: socket.id,
          startedAt: Date.now(),
        });
      } catch (err) {
        console.error('[Error in start-recording handler]:', err);
      }
    });

    socket.on('stop-recording', (payload?: { hostName?: string }) => {
      try {
        const roomId = roomManager.getRoomIdForSocket(socket.id);
        if (!roomId) return;

        // Security check: Only the meeting host can stop recording
        if (!roomManager.isHost(socket.id)) {
          console.warn(`[Security] Rejected stop-recording: Socket ${socket.id} is not the host of room "${roomId}"`);
          return;
        }

        const participant = roomManager.getParticipant(socket.id);
        const hostName = payload?.hostName || participant?.displayName || 'Host';

        console.log(`[Recording Stopped] Host Socket: ${socket.id} (${hostName}) in Room: "${roomId}"`);
        io.to(roomId).emit('recording-stopped', {
          hostName,
          stoppedAt: Date.now(),
        });
      } catch (err) {
        console.error('[Error in stop-recording handler]:', err);
      }
    });

    // Handle explicit leave-room
    socket.on('leave-room', () => {
      handleUserLeave(socket, io, roomManager, 'User left intentionally');
    });

    // Handle Disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket Disconnected] ID: ${socket.id} Reason: ${reason}`);
      handleUserLeave(socket, io, roomManager, 'Connection disconnected');
    });
  });
}

function handleUserLeave(socket: Socket, io: Server, roomManager: RoomManager, reason: string) {
  const result = roomManager.leaveRoom(socket.id);
  if (result.roomId && result.participant) {
    console.log(
      `[User Left Room] Socket: ${socket.id} (${result.participant.displayName}) from Room: "${result.roomId}". Remaining: ${result.remainingCount}. Reason: ${reason}`
    );
    socket.leave(result.roomId);
    socket.to(result.roomId).emit('user-left', {
      socketId: socket.id,
      displayName: result.participant.displayName,
      reason,
    });

    // Notify peers if room host was reassigned
    if (result.newHost) {
      console.log(
        `[Host Reassigned] Room: "${result.roomId}" New Host: ${result.newHost.hostSocketId} (${result.newHost.hostName})`
      );
      io.to(result.roomId).emit('host-changed', result.newHost);
    }

    // Record participant departure in MongoDB or fallback store
    trackUserLeft(result.roomId, socket.id, result.remainingCount);
  }
}
