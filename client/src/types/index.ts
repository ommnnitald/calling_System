export type CallStatus =
  | 'idle'
  | 'joining'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'peer-disconnected'
  | 'room-full'
  | 'call-ended'
  | 'error';

export interface Participant {
  socketId: string;
  displayName: string;
  joinedAt: number;
  isHost?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}

export interface RoomJoinedResponse {
  roomId: string;
  self: Participant;
  otherParticipants: Participant[];
  isHost?: boolean;
  hostSocketId?: string;
}

export interface HostChangedData {
  hostSocketId: string;
  hostName: string;
  hostUserId?: string;
}

export interface MediaPermissionError {
  type: 'permission-denied' | 'device-unavailable' | 'not-supported' | 'unknown';
  device: 'camera' | 'microphone' | 'both';
  message: string;
}

export interface SignalingOffer {
  from: string;
  senderName: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalingAnswer {
  from: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalingIceCandidate {
  from: string;
  candidate: RTCIceCandidateInit;
}

export interface SignalingUserLeft {
  socketId: string;
  displayName: string;
  reason?: string;
}

export interface RemotePeer {
  participant: Participant;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  isScreenSharing?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSelf?: boolean;
}

export interface FloatingReaction {
  id: string;
  senderId: string;
  senderName: string;
  emoji: string;
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  createdAt: string;
}

export interface CallParticipantRecord {
  displayName: string;
  userId?: string;
  joinedAt: string;
  leftAt?: string;
  staySeconds?: number;
  isSelf: boolean;
  isHost?: boolean;
}

export interface CallHistoryItem {
  id: string;
  roomId: string;
  hostName: string;
  hostUserId?: string;
  isHost: boolean;
  status: 'active' | 'completed';
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  maxConcurrentPeers?: number;
  participantCount: number;
  participants: CallParticipantRecord[];
}

export interface CallStats {
  totalCalls: number;
  totalMinutes: number;
  hostedCount: number;
  recentRooms: string[];
}

export interface RecordingItem {
  id: string;
  roomId: string;
  hostUserId?: string;
  hostName: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  mimeType: string;
  createdAt: string;
}

