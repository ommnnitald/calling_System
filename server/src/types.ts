export interface Participant {
  socketId: string;
  displayName: string;
  joinedAt: number;
  userId?: string;
  isHost?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}

export interface JoinRoomPayload {
  roomId: string;
  displayName: string;
  userId?: string;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}

export interface MediaTogglePayload {
  roomId?: string;
  type: 'audio' | 'video';
  isMuted: boolean;
}

export interface OfferPayload {
  to: string;
  sdp: any;
}

export interface AnswerPayload {
  to: string;
  sdp: any;
}

export interface IceCandidatePayload {
  to: string;
  candidate: any;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface RoomJoinedResponse {
  roomId: string;
  self: Participant;
  otherParticipants: Participant[];
  isHost: boolean;
  hostSocketId: string;
}

export interface HostChangedPayload {
  hostSocketId: string;
  hostName: string;
  hostUserId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface SendChatMessagePayload {
  roomId?: string;
  text: string;
}

export interface ReactionPayload {
  roomId?: string;
  emoji: string;
}

export interface BroadcastReactionPayload {
  id: string;
  senderId: string;
  senderName: string;
  emoji: string;
  timestamp: number;
}

