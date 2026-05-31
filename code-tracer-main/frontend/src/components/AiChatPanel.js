import React, { useMemo, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import useTraceStore from '@/store/traceStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PaperPlaneRight, Robot, User, Sparkle, Trash } from '@phosphor-icons/react';

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api";

const QUICK_PROMPTS = [
  "What does this code do?",
  "Explain the variables",
  "Why does this loop run?",
  "How can I optimize this?",
];

const AiChatPanel = () => {
  const code = useTraceStore((s) => s.code);
  const language = useTraceStore((s) => s.language);
  const traceSummary = useTraceStore((s) => s.traceSummary);
  const steps = useTraceStore((s) => s.steps);
  const currentStep = useTraceStore((s) => s.currentStep);
  const messages = useTraceStore((s) => s.aiChatMessages);
  const addChatMessage = useTraceStore((s) => s.addChatMessage);
  const clearChatMessages = useTraceStore((s) => s.clearChatMessages);

  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const stepContext = useMemo(() => {
    const state = steps[currentStep];
    if (!state) return null;
    return {
      line: state.line,
      func: state.func,
      stack_depth: Math.max((state.stack_frames || []).length - 1, 0),
      variables: (state.variables || []).map((v) => ({
        name: v.name,
        value: v.value,
        type: v.type,
      })),
    };
  }, [steps, currentStep]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (text) => {
    const trimmed = (text || question).trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setError(null);
    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    addChatMessage({ role: 'user', content: trimmed });
    setQuestion('');

    try {
      const res = await axios.post(`${API}/ai/chat`, {
        code,
        language,
        trace_summary: traceSummary,
        question: trimmed,
        chat_history: nextMessages.slice(-6),
        step_context: stepContext,
      }, { timeout: 120000 });

      addChatMessage({ role: 'assistant', content: res.data.answer || 'No response.' });
    } catch (err) {
      const errMsg = err.response?.data?.answer || err.message || 'Failed to reach AI service.';
      setError(errMsg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div data-testid="ai-chat-panel" className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Robot size={14} weight="fill" className="text-blue-400" />
          <span className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">
            AI Tutor
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChatMessages}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Clear chat"
          >
            <Trash size={12} />
          </button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Robot size={32} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500 font-plex">
                  Ask about the code, loops, variables, or complexity.
                </p>
                <p className="text-[10px] text-zinc-600 font-plex mt-1">
                  The AI tutor sees your code and trace data.
                </p>
              </div>
              {/* Quick prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    disabled={isSending}
                    className="text-left px-2.5 py-2 rounded border border-zinc-800/60 bg-zinc-900/40 text-[11px] font-plex text-zinc-400 hover:text-blue-300 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-200 disabled:opacity-40"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkle size={10} weight="fill" className="text-violet-400" />
                  </div>
                )}
                <div
                  className={`max-w-[90%] sm:max-w-[85%] px-2.5 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-plex whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'bg-zinc-900/60 border border-zinc-800/60 text-zinc-200'
                      : 'bg-blue-500/10 border border-blue-500/20 text-blue-200'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={10} weight="fill" className="text-blue-400" />
                  </div>
                )}
              </div>
            ))
          )}
          {/* Typing indicator */}
          {isSending && (
            <div className="flex gap-2 items-start">
              <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <Sparkle size={10} weight="fill" className="text-violet-400" />
              </div>
              <div className="px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="px-4 pb-1 text-[10px] font-plex text-red-400 truncate">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-2 sm:p-3 border-t border-zinc-800/60 flex items-center gap-2">
        <input
          data-testid="ai-chat-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about this code..."
          disabled={isSending}
          className="flex-1 bg-zinc-900/70 border border-zinc-800/60 rounded-lg px-3 py-2 text-xs font-plex text-zinc-200 outline-none focus:border-blue-500/40 transition-colors placeholder:text-zinc-600 disabled:opacity-50"
        />
        <button
          data-testid="ai-chat-send"
          type="button"
          onClick={() => handleSend()}
          disabled={isSending || !question.trim()}
          className="p-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <PaperPlaneRight size={14} weight="fill" />
        </button>
      </div>
    </div>
  );
};

export default AiChatPanel;
