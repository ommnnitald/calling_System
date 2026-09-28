import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare, Smile, CheckCheck } from 'lucide-react';
import { ChatMessage } from '../types';

interface InCallChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSendReaction?: (emoji: string) => void;
  currentUserId?: string;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '👏', '🎉', '🔥'];

export const InCallChat: React.FC<InCallChatProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onSendReaction,
  currentUserId,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Auto focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const formatTime = (timestamp: number): string => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <aside
      id="in-call-chat-panel"
      data-testid="in-call-chat-panel"
      aria-label="In-call chat"
      className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              In-Call Messages
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-mono">
                {messages.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Messages are visible to call participants</p>
          </div>
        </div>
        <button
          id="btn-close-chat"
          data-testid="btn-close-chat"
          onClick={onClose}
          aria-label="Close chat panel"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Reaction Pill Row */}
      {onSendReaction && (
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between gap-1 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 flex-shrink-0">
            <Smile className="w-3.5 h-3.5 text-emerald-400" /> React:
          </span>
          <div className="flex items-center gap-1.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction(emoji)}
                title={`Send ${emoji}`}
                className="text-base p-1.5 rounded-lg hover:bg-slate-800 hover:scale-125 transition-all select-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages List */}
      <div
        id="chat-messages-container"
        data-testid="chat-messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-3 text-slate-400 border border-slate-700/50">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">No messages yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
              Send a message or reaction to everyone in this call.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.isSelf || (currentUserId && msg.senderId === currentUserId);
            return (
              <div
                key={msg.id}
                data-testid="chat-message-item"
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                {!isSelf && (
                  <span className="text-[11px] font-semibold text-emerald-400 mb-0.5 px-1 truncate max-w-[200px]">
                    {msg.senderName}
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-md break-words ${
                    isSelf
                      ? 'bg-emerald-600 text-white rounded-tr-none border border-emerald-500/40'
                      : 'bg-slate-800/90 text-slate-100 rounded-tl-none border border-slate-700/60'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isSelf ? 'text-emerald-200/90' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatTime(msg.timestamp)}</span>
                    {isSelf && <CheckCheck className="w-3.5 h-3.5 inline text-emerald-200" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          id="chat-input"
          data-testid="chat-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
        />
        <button
          id="btn-send-message"
          data-testid="btn-send-message"
          type="submit"
          disabled={!inputText.trim()}
          title="Send message"
          className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:hover:bg-emerald-600 transition-all shadow-md shadow-emerald-600/20 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
};
