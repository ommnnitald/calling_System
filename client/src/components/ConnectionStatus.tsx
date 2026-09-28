import React from 'react';
import { CallStatus, MediaPermissionError } from '../types';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2, PhoneOff, Users, Wifi } from 'lucide-react';

interface ConnectionStatusProps {
  status: CallStatus;
  permissionError: MediaPermissionError | null;
  errorMessage: string | null;
  peerName?: string;
  onRetry?: () => void;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  permissionError,
  errorMessage,
  peerName,
  onRetry,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center gap-2 z-10 w-full max-w-xl mx-auto ${className}`}>
      {/* Device Permission Error Banner */}
      {permissionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full flex items-start gap-3 bg-amber-500/15 border border-amber-500/30 text-amber-200 px-4 py-2.5 rounded-xl text-sm backdrop-blur-md shadow-lg"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <span className="font-semibold block">
              {permissionError.type === 'permission-denied'
                ? 'Permission Denied'
                : permissionError.device === 'camera'
                ? 'Camera Unavailable'
                : 'Microphone Unavailable'}
            </span>
            <span className="text-xs text-amber-300/80">{permissionError.message}</span>
            {onRetry && (
              <button
                type="button"
                id="btn-retry-media"
                onClick={onRetry}
                className="mt-1.5 inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 rounded-lg transition-colors border border-amber-400/40 focus:outline-none focus:ring-1 focus:ring-amber-300"
              >
                Allow / Retry Media Access
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Connection Status Pill */}
      <div role="status" aria-live="polite" className="flex items-center justify-center">
        {status === 'waiting' && (
          <div
            data-testid="status-waiting"
            className="inline-flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 text-amber-300 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md shadow-md"
          >
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" aria-hidden="true" />
            <span>Waiting for another participant to join...</span>
          </div>
        )}

        {status === 'connecting' && (
          <div
            data-testid="status-connecting"
            className="inline-flex items-center gap-2.5 bg-sky-500/10 border border-sky-500/25 text-sky-300 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md shadow-md"
          >
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" aria-hidden="true" />
            <span>Connecting with {peerName || 'peer'}...</span>
          </div>
        )}

        {status === 'connected' && (
          <div
            data-testid="status-connected"
            className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md shadow-md tracking-wide"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>CONNECTED &bull; {peerName || 'Peer'}</span>
          </div>
        )}

        {status === 'peer-disconnected' && (
          <div
            data-testid="status-peer-disconnected"
            className="inline-flex items-center gap-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md shadow-md"
          >
            <PhoneOff className="w-4 h-4 text-rose-400" aria-hidden="true" />
            <span>Peer disconnected</span>
          </div>
        )}

        {status === 'room-full' && (
          <div
            role="alert"
            data-testid="status-room-full"
            className="inline-flex items-center gap-2.5 bg-red-500/20 border border-red-500/40 text-red-200 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold backdrop-blur-md shadow-lg"
          >
            <Users className="w-5 h-5 text-red-400" aria-hidden="true" />
            <span>Room Full (Max 10 participants)</span>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div
            role="alert"
            data-testid="status-error"
            className="inline-flex items-center gap-2.5 bg-red-500/20 border border-red-500/40 text-red-200 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold backdrop-blur-md shadow-lg"
          >
            <AlertCircle className="w-5 h-5 text-red-400" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
