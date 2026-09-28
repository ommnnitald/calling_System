import React, { useState, useEffect } from 'react';
import { X, Server, Check, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { getServerUrl, setServerUrl, DEFAULT_LAN_SERVER_URL, isNativeApp } from '../services/config';
import { disconnectSocket, initializeSocket } from '../services/socket';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrl(getServerUrl());
      setStatus('idle');
      setStatusMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const testAndSave = async (targetUrl: string) => {
    const cleanUrl = targetUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) return;

    setStatus('testing');
    setStatusMsg('Testing server connection...');

    try {
      const res = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'ok') {
        setServerUrl(cleanUrl);
        disconnectSocket();
        initializeSocket();
        setStatus('success');
        setStatusMsg(`Connected! Server mode: ${data.database?.connected ? 'MongoDB Live' : 'Local Persistent'}`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setStatus('error');
        setStatusMsg('Server responded, but health check failed.');
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(`Connection failed: ${err.message || 'Unable to reach server. Please verify Wi-Fi and IP address.'}`);
    }
  };

  const handleResetDefault = () => {
    setUrl(DEFAULT_LAN_SERVER_URL);
    testAndSave(DEFAULT_LAN_SERVER_URL);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 relative text-slate-100"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Server Connection</h3>
              <p className="text-xs text-slate-400">
                {isNativeApp() ? 'Android App Server Endpoint' : 'Signaling & API Server URL'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isNativeApp() && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-300">
            <Smartphone className="w-4 h-4 flex-shrink-0" />
            <span>Running natively on Android. Ensure your device is on the same Wi-Fi network as the server host.</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            testAndSave(url);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Backend Server URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.1.102:5000"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Default LAN URL: <code className="text-slate-400">{DEFAULT_LAN_SERVER_URL}</code>
            </p>
          </div>

          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                status === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : status === 'error'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {status === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {status === 'success' && <Check className="w-3.5 h-3.5" />}
              {status === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3.5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all active:scale-95"
            >
              Reset Default
            </button>
            <button
              type="submit"
              disabled={status === 'testing' || !url.trim()}
              className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              {status === 'testing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Save & Connect</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
