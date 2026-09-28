import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Share2, X, Users, Link2, Sparkles } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  roomId,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const getInviteUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    }
    return `/?room=${encodeURIComponent(roomId)}`;
  };

  const inviteUrl = getInviteUrl();

  const handleCopyLink = async () => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    }
  };

  const handleCopyCode = async () => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(roomId);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    }
  };

  const handleOpenDirectly = () => {
    window.open(inviteUrl, '_blank');
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join StreamCall Video Room',
          text: `Join my live video call on StreamCall! Room: ${roomId}`,
          url: inviteUrl,
        });
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }
    handleCopyLink();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-invite-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-lg p-6 sm:p-7 rounded-3xl border border-slate-700/80 shadow-2xl bg-[#0f172a]/95 text-slate-100 flex flex-col gap-5 relative animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close invite modal"
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Link2 className="w-6 h-6" />
          </div>
          <div>
            <h2 id="modal-invite-title" className="text-xl font-bold text-white flex items-center gap-2">
              Invite to Call
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                Up to 10
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Share this automated invite link with friends or coworkers
            </p>
          </div>
        </div>

        {/* Automated Generated Link Box */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Automated Generated Invite Link
          </label>
          <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 focus-within:border-emerald-500 transition-colors">
            <input
              id="invite-link-input"
              type="text"
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm font-mono text-emerald-400 select-all outline-none"
            />
            <button
              id="btn-modal-copy-link"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-500/20 active:scale-95 flex-shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-950" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Directly open joining page */}
          <button
            id="btn-modal-open-direct"
            onClick={handleOpenDirectly}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs sm:text-sm border border-slate-700 transition-all active:scale-95 shadow-sm"
          >
            <ExternalLink className="w-4 h-4 text-teal-400" />
            <span>Open Joining Page</span>
          </button>

          {/* Native Web Share */}
          <button
            id="btn-modal-share-native"
            onClick={handleShareNative}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs sm:text-sm border border-slate-700 transition-all active:scale-95 shadow-sm"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Share via App...</span>
          </button>
        </div>

        {/* Room ID Badge & Tip */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Room Code:</span>
            <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">
              {roomId}
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
