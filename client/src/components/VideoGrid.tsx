import React, { useState } from 'react';
import { RemotePeer } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { Copy, Check, Maximize2, Minimize2, Users, Link2 } from 'lucide-react';

interface VideoGridProps {
  localStream: MediaStream | null;
  localDisplayName: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  remotePeers: RemotePeer[];
  roomId: string;
  onOpenInvite: () => void;
  onCopyInvite: () => void;
  copiedLink: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  localStream,
  localDisplayName,
  isMicOn,
  isCameraOn,
  remotePeers,
  roomId,
  onOpenInvite,
  onCopyInvite,
  copiedLink,
}) => {
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  const totalParticipants = 1 + remotePeers.length;

  // Toggle spotlight for a specific participant
  const handleToggleSpotlight = (id: string) => {
    setSpotlightId((prev) => (prev === id ? null : id));
  };

  // ----------------------------------------------------
  // SCENARIO 1: Solo (0 remote peers)
  // ----------------------------------------------------
  if (remotePeers.length === 0) {
    return (
      <div className="relative w-full h-full max-w-4xl max-h-[82vh] mx-auto flex flex-col items-center justify-center">
        <div data-testid="local-video-container" className="relative w-full h-full">
          <VideoPlayer
            stream={localStream}
            displayName={localDisplayName}
            isMuted={!isMicOn}
            isCameraOn={isCameraOn}
            isLocal={true}
            className="w-full h-full"
          />

          {/* Waiting Overlay Badge with Quick Copy & Direct Invite */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end p-6 pb-12 sm:pb-16">
            <div className="glass-panel px-6 py-4 rounded-3xl border border-slate-700/80 shadow-2xl text-center pointer-events-auto max-w-sm backdrop-blur-2xl">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  1 / 10 in room
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                Waiting for others to join...
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Share this Room ID or invite link with your team (up to 10):
              </p>
              <div className="flex items-center justify-between gap-2 bg-slate-900/95 py-2 px-3 rounded-xl border border-slate-800 mb-2.5">
                <span className="font-mono text-emerald-400 font-bold text-sm tracking-wide">
                  {roomId}
                </span>
                <button
                  id="btn-copy-code"
                  onClick={onCopyInvite}
                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Direct Invite Button */}
              <button
                id="btn-waiting-invite"
                onClick={onOpenInvite}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <Link2 className="w-4 h-4" />
                <span>Get Automated Invite Link</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // SCENARIO 2: 1 Remote Peer (1-to-1 Call)
  // Renders primary remote video stage with PiP local video
  // ----------------------------------------------------
  if (remotePeers.length === 1 && !spotlightId) {
    const peer = remotePeers[0];
    return (
      <div className="relative w-full h-full max-w-7xl max-h-[84vh] mx-auto flex items-center justify-center">
        {/* Primary Remote Video */}
        <div data-testid="remote-video-container" className="w-full h-full">
          <VideoPlayer
            stream={peer.stream}
            displayName={peer.participant.displayName}
            isMuted={peer.isAudioMuted || false}
            isCameraOn={peer.isVideoMuted !== true}
            isLocal={false}
            className="w-full h-full"
          />
        </div>

        {/* Floating Local Preview (Picture-in-Picture) */}
        <div
          data-testid="local-video-container"
          className="absolute top-3 right-3 sm:top-5 sm:right-5 w-32 h-24 sm:w-56 sm:h-38 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/90 z-20 transition-all duration-300 hover:scale-105 hover:border-emerald-500/50"
        >
          <VideoPlayer
            stream={localStream}
            displayName={localDisplayName}
            isMuted={!isMicOn}
            isCameraOn={isCameraOn}
            isLocal={true}
            className="w-full h-full"
          />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // SCENARIO 3: Multi-Party (2 to 9 remote peers, up to 10 total)
  // Adaptive Grid or Spotlight Mode
  // ----------------------------------------------------
  const allTiles = [
    {
      id: 'local',
      stream: localStream,
      displayName: localDisplayName,
      isLocal: true,
      isMuted: !isMicOn,
      isCameraOn,
    },
    ...remotePeers.map((p) => ({
      id: p.participant.socketId,
      stream: p.stream,
      displayName: p.participant.displayName,
      isLocal: false,
      isMuted: p.isAudioMuted || false,
      isCameraOn: p.isVideoMuted !== true,
    })),
  ];

  // If Spotlight Mode is active
  if (spotlightId) {
    const spotlightTile = allTiles.find((t) => t.id === spotlightId) || allTiles[0];
    const filmstripTiles = allTiles.filter((t) => t.id !== spotlightId);

    return (
      <div className="w-full h-full max-w-7xl mx-auto flex flex-col gap-3 pb-2">
        {/* Main Spotlighted Stage */}
        <div
          data-testid={spotlightTile.isLocal ? 'local-video-container' : 'remote-video-container'}
          className="relative flex-1 min-h-[50vh] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group"
        >
          <VideoPlayer
            stream={spotlightTile.stream}
            displayName={spotlightTile.displayName}
            isMuted={spotlightTile.isMuted}
            isCameraOn={spotlightTile.isCameraOn}
            isLocal={spotlightTile.isLocal}
            className="w-full h-full"
          />
          <button
            onClick={() => handleToggleSpotlight(spotlightTile.id)}
            title="Exit Spotlight"
            className="absolute top-2.5 left-2.5 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Filmstrip of Remaining Participants */}
        <div className="h-28 sm:h-36 flex items-center gap-3 overflow-x-auto py-1 px-1">
          {filmstripTiles.map((tile) => (
            <div
              key={tile.id}
              data-testid={tile.isLocal ? 'local-video-container' : 'remote-video-container'}
              onClick={() => handleToggleSpotlight(tile.id)}
              className="relative h-full aspect-video rounded-xl overflow-hidden border border-slate-800/80 hover:border-emerald-500 cursor-pointer transition-all hover:scale-105 flex-shrink-0 shadow-lg group"
            >
              <VideoPlayer
                stream={tile.stream}
                displayName={tile.displayName}
                isMuted={tile.isMuted}
                isCameraOn={tile.isCameraOn}
                isLocal={tile.isLocal}
                className="w-full h-full pointer-events-none"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Dynamic Grid Configuration based on participant count
  let gridColsClass = 'grid-cols-1 md:grid-cols-2';
  if (totalParticipants === 3) {
    gridColsClass = 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
  } else if (totalParticipants === 4) {
    gridColsClass = 'grid-cols-2';
  } else if (totalParticipants <= 6) {
    gridColsClass = 'grid-cols-2 md:grid-cols-3';
  } else if (totalParticipants <= 9) {
    gridColsClass = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-3';
  } else {
    gridColsClass = 'grid-cols-2 md:grid-cols-4';
  }

  return (
    <div className="w-full h-full max-w-7xl mx-auto flex flex-col justify-center">
      <div className={`grid ${gridColsClass} gap-3 sm:gap-4 w-full h-full max-h-[80vh] auto-rows-fr items-center`}>
        {allTiles.map((tile) => (
          <div
            key={tile.id}
            data-testid={tile.isLocal ? 'local-video-container' : 'remote-video-container'}
            className="relative w-full h-full min-h-[160px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl group hover:border-slate-700 transition-all bg-slate-900"
          >
            <VideoPlayer
              stream={tile.stream}
              displayName={tile.displayName}
              isMuted={tile.isMuted}
              isCameraOn={tile.isCameraOn}
              isLocal={tile.isLocal}
              className="w-full h-full"
            />
            {/* Spotlight Pin Button on Top-Left */}
            <button
              onClick={() => handleToggleSpotlight(tile.id)}
              title="Spotlight Participant"
              className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
