import React, { useEffect, useRef, useState } from 'react';
import { Msg, ToolStep } from './game/types';

interface PromptModalProps {
  messages: Msg[];
  credits: number;
  inFlight: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

const ToolLine: React.FC<{ tool: ToolStep }> = ({ tool }) => (
  <div className="ml-4 text-[11px]">
    <span className="text-[#ffd66b]">
      {tool.status === 'running' ? '⟳' : tool.error ? '✗' : '✓'} {tool.name}
    </span>
    {tool.args && <span className="ml-2 text-[#7ad97a]/70">{tool.args}</span>}
    {tool.error && <span className="ml-2 text-[#ff8a8a]">{tool.error}</span>}
  </div>
);

const PromptModal: React.FC<PromptModalProps> = ({
  messages,
  credits,
  inFlight,
  onSubmit,
  onClose,
}) => {
  const [text, setText] = useState('');
  const [showThinking, setShowThinking] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, inFlight]);

  const canSubmit = !inFlight && credits > 0 && text.trim().length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!canSubmit) return;
      onSubmit(text.trim());
      setText('');
    }
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleContainerKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col bg-black/90 text-[#d6f5d6] font-mono"
      onKeyDown={handleContainerKeyDown}
      onKeyUp={handleContainerKeyUp}
    >
      <div className="flex items-center justify-between border-b border-[#2f5d2f] px-4 py-2 text-xs">
        <span className="tracking-widest text-[#aef0ae]">TOASTY ~ COPILOT</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1 text-[10px] text-[#7ad97a]/80">
            <input
              type="checkbox"
              checked={showThinking}
              onChange={(e) => setShowThinking(e.target.checked)}
              className="accent-[#aef0ae]"
            />
            THINKING
          </label>
          <span>
            CREDITS <span className="text-[#ffd66b]">{credits}</span>
          </span>
          <span className={inFlight ? 'text-[#ffd66b]' : 'text-[#7ad97a]'}>
            {inFlight ? 'WORKING...' : 'READY'}
          </span>
          <button
            type="button"
            className="border border-[#2f5d2f] px-2 py-0.5 text-[10px] hover:bg-[#1a3a1a]"
            onClick={onClose}
          >
            CLOSE [ESC]
          </button>
        </div>
      </div>

      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed"
      >
        {messages.length === 0 && (
          <div className="text-[#7ad97a]/70">
            {`Toasty waits, ears twitching. Type a prompt below.\nThe agent runs in this project's working directory.`}
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="mb-3 whitespace-pre-wrap break-words">
                <span className="text-[#aef0ae]">$ </span>
                <span>{m.text}</span>
              </div>
            );
          }
          if (m.role === 'system') {
            return (
              <div key={i} className="mb-3 whitespace-pre-wrap break-words">
                <span className="text-[#ff8a8a]">! </span>
                <span className="text-[#ff8a8a]">{m.text}</span>
              </div>
            );
          }
          // assistant
          return (
            <div key={i} className="mb-4 whitespace-pre-wrap break-words">
              {showThinking && m.reasoning && (
                <div className="mb-1 border-l-2 border-[#3a5a3a] pl-2 text-[12px] italic text-[#7ad97a]/70">
                  {m.reasoning}
                </div>
              )}
              {m.tools && m.tools.length > 0 && (
                <div className="mb-1">
                  {m.tools.map((t) => (
                    <ToolLine key={t.toolCallId} tool={t} />
                  ))}
                </div>
              )}
              {m.text && (
                <div>
                  <span className="text-[#d6f5d6]">{'> '}</span>
                  <span>{m.text}</span>
                </div>
              )}
              {!m.done && !m.text && !m.reasoning && (!m.tools || m.tools.length === 0) && (
                <div className="text-[#ffd66b]/80">{'> ...'}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#2f5d2f] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[#aef0ae]">$</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={inFlight}
            placeholder={
              credits <= 0
                ? 'Out of credits. Defeat an enemy to earn one.'
                : inFlight
                  ? 'Waiting for response...'
                  : 'Type prompt and press Enter'
            }
            className="flex-1 bg-transparent outline-none placeholder:text-[#7ad97a]/40 disabled:opacity-50"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="mt-1 text-[10px] text-[#7ad97a]/70">
          Enter to send (-1 credit). Esc to close.
        </div>
      </div>
    </div>
  );
};

export default PromptModal;
