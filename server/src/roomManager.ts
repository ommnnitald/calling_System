import { Participant } from './types.js';

export interface Room {
  id: string;
  hostSocketId: string;
  hostName: string;
  hostUserId?: string;
  participants: Map<string, Participant>;
  createdAt: number;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();
  private readonly MAX_PARTICIPANTS = 10;

  /**
   * Attempt to join or create a room.
   * Validates room ID and display name, capping participants at 10.
   * Designates the creator / first participant as the room host.
   */
  public joinRoom(
    roomId: string,
    socketId: string,
    displayName: string,
    isAudioMuted: boolean = false,
    isVideoMuted: boolean = false,
    userId?: string
  ): {
    success: boolean;
    reason?: 'room_full' | 'already_joined' | 'invalid_params';
    message?: string;
    room?: Room;
    self?: Participant;
    otherParticipants?: Participant[];
    isHost?: boolean;
    hostSocketId?: string;
  } {
    if (!roomId || typeof roomId !== 'string') {
      return { success: false, reason: 'invalid_params', message: 'Room ID must be a valid string.' };
    }

    const cleanRoomId = roomId.trim().substring(0, 64);
    const cleanName = (typeof displayName === 'string' ? displayName.trim() : 'Anonymous').substring(0, 50) || 'Anonymous';

    if (!cleanRoomId) {
      return { success: false, reason: 'invalid_params', message: 'Room ID cannot be empty.' };
    }

    let isHost = false;
    let room = this.rooms.get(cleanRoomId);
    if (!room) {
      room = {
        id: cleanRoomId,
        hostSocketId: socketId,
        hostName: cleanName,
        hostUserId: userId,
        participants: new Map<string, Participant>(),
        createdAt: Date.now(),
      };
      this.rooms.set(cleanRoomId, room);
      isHost = true;
    } else {
      if (room.participants.size === 0 || !room.hostSocketId) {
        room.hostSocketId = socketId;
        room.hostName = cleanName;
        room.hostUserId = userId;
        isHost = true;
      } else {
        isHost = room.hostSocketId === socketId;
      }
    }

    // Check if room is full and user isn't already inside
    if (room.participants.size >= this.MAX_PARTICIPANTS && !room.participants.has(socketId)) {
      return {
        success: false,
        reason: 'room_full',
        message: `Room "${cleanRoomId}" is already full (maximum ${this.MAX_PARTICIPANTS} participants).`,
      };
    }

    const participant: Participant = {
      socketId,
      displayName: cleanName,
      joinedAt: Date.now(),
      userId,
      isHost,
      isAudioMuted,
      isVideoMuted,
    };

    room.participants.set(socketId, participant);
    this.socketToRoom.set(socketId, cleanRoomId);

    const otherParticipants = Array.from(room.participants.values())
      .filter((p) => p.socketId !== socketId)
      .map((p) => ({
        ...p,
        isHost: p.socketId === room?.hostSocketId,
      }));

    return {
      success: true,
      room,
      self: participant,
      otherParticipants,
      isHost,
      hostSocketId: room.hostSocketId,
    };
  }

  /**
   * Update participant audio or video mute state
   */
  public updateParticipantMedia(
    socketId: string,
    type: 'audio' | 'video',
    isMuted: boolean
  ): { roomId?: string; participant?: Participant } {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return {};

    const room = this.rooms.get(roomId);
    if (!room) return { roomId };

    const participant = room.participants.get(socketId);
    if (!participant) return { roomId };

    if (type === 'audio') {
      participant.isAudioMuted = isMuted;
    } else if (type === 'video') {
      participant.isVideoMuted = isMuted;
    }

    return { roomId, participant };
  }

  /**
   * Remove a participant from their current room.
   * If the departing participant was the room host, automatically reassigns host
   * status to the next oldest remaining participant.
   */
  public leaveRoom(socketId: string): {
    roomId: string | null;
    participant: Participant | null;
    remainingCount: number;
    newHost?: { hostSocketId: string; hostName: string; hostUserId?: string };
  } {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) {
      return { roomId: null, participant: null, remainingCount: 0 };
    }

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomId);
    if (!room) {
      return { roomId, participant: null, remainingCount: 0 };
    }

    const participant = room.participants.get(socketId) || null;
    const wasHost = room.hostSocketId === socketId;
    room.participants.delete(socketId);

    const remainingCount = room.participants.size;
    let newHost: { hostSocketId: string; hostName: string; hostUserId?: string } | undefined;

    if (remainingCount === 0) {
      this.rooms.delete(roomId);
    } else if (wasHost) {
      // Reassign host to the next participant in room
      const nextParticipant = room.participants.values().next().value;
      if (nextParticipant) {
        nextParticipant.isHost = true;
        room.hostSocketId = nextParticipant.socketId;
        room.hostName = nextParticipant.displayName;
        room.hostUserId = nextParticipant.userId;
        newHost = {
          hostSocketId: nextParticipant.socketId,
          hostName: nextParticipant.displayName,
          hostUserId: nextParticipant.userId,
        };
      }
    }

    return {
      roomId,
      participant,
      remainingCount,
      newHost,
    };
  }

  public getRoomIdForSocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public isHost(socketId: string): boolean {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return false;
    const room = this.rooms.get(roomId);
    return Boolean(room && room.hostSocketId === socketId);
  }

  public getParticipant(socketId: string): Participant | undefined {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return undefined;
    const room = this.rooms.get(roomId);
    return room?.participants.get(socketId);
  }

  /**
   * Verify if two sockets are peers in the same room
   */
  public arePeersInSameRoom(socketId1: string, socketId2: string): boolean {
    const r1 = this.socketToRoom.get(socketId1);
    const r2 = this.socketToRoom.get(socketId2);
    return Boolean(r1 && r2 && r1 === r2);
  }
}
