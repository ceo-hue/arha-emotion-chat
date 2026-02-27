import React, { useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Send, Loader2 } from 'lucide-react';
import ConflictGauge from './ConflictGauge';
import type { TestResult } from '../types';

interface LiveOutputProps {
  onTest: (message: string) => Promise<void>;
  testResult: TestResult | null;
  isTesting: boolean;
}

export default function LiveOutput({ onTest, testResult, isTesting }: LiveOutputProps) {
  const { t } = useI18n();
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || isTesting) return;
    onTest(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/10">
        <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">{t.liveOutput}</h2>
      </div>

      {/* Response area */}
      <div className="flex-1 overflow-y-auto scroll-hide p-4 space-y-4">
        {/* Test result */}
        {testResult ? (
          <>
            {/* Response text */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[12px] text-white/80 leading-relaxed whitespace-pre-wrap">
                {testResult.response}
              </p>
            </div>

            {/* Conflict gauge */}
            <ConflictGauge
              value={testResult.conflictIndex}
              matchedKeywords={testResult.matchedKeywords}
              totalExpected={testResult.totalExpectedKeywords}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-[11px] text-white/15 text-center">{t.responseArea}</p>
          </div>
        )}

        {/* Loading state */}
        {isTesting && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 size={14} className="text-violet-400 animate-spin" />
            <span className="text-[11px] text-violet-400/70">{t.sending}</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 p-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.testInput}
            rows={1}
            className="flex-1 px-3 py-2.5 rounded-xl glass-sunken text-[12px] text-white/80 placeholder-white/20 resize-none outline-none focus:border-violet-400/30 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTesting}
            className="shrink-0 w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-400 hover:bg-violet-500/30 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
