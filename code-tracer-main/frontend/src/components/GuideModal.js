import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, X } from '@phosphor-icons/react';

const GuideSection = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-xs font-plex tracking-[0.15em] uppercase text-zinc-400">
      {title}
    </h3>
    <div className="text-xs text-zinc-300 font-plex leading-relaxed space-y-1">
      {children}
    </div>
  </section>
);

const GuideBadge = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/70 px-2 py-0.5 text-[10px] font-plex uppercase tracking-[0.12em] text-zinc-200">
    {children}
  </span>
);

const GuideModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close guide"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
      />
      <div className="absolute inset-x-3 sm:inset-x-12 top-10 bottom-10">
        <div className="h-full rounded-2xl border border-zinc-800/60 bg-zinc-950/95 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={16} weight="fill" className="text-blue-400" />
              <h2 className="text-sm font-cabinet font-bold text-zinc-100">Guide</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label="Close"
            >
              <X size={14} weight="bold" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 sm:p-5 space-y-5">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-200 font-plex">
                  <strong>Looking for a comprehensive guide?</strong> Check out the full documentation at{' '}
                  <a href="https://github.com/astrilo-monk/code-tracer-guide" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                    astrilo-monk/code-tracer-guide
                  </a>
                </p>
              </div>

              <GuideSection title="Quick Start">
                <p>Paste C or Java code, then click Run & Trace to generate a step-by-step execution trace.</p>
                <p>Use the playback controls to step, play, or scrub the timeline.</p>
              </GuideSection>

              <GuideSection title="Header Controls">
                <p>
                  <GuideBadge>Run &amp; Trace</GuideBadge>
                  <span className="ml-2">Compiles and traces your code in the backend.</span>
                </p>
                <p>
                  <GuideBadge>Reset</GuideBadge>
                  <span className="ml-2">Jumps back to step 1 without re-running.</span>
                </p>
                <p className="flex flex-wrap gap-2">
                  <GuideBadge>Step Back</GuideBadge>
                  <GuideBadge>Play/Pause</GuideBadge>
                  <GuideBadge>Step Forward</GuideBadge>
                  <span className="text-zinc-400">Navigate the trace.</span>
                </p>
                <p>
                  <GuideBadge>Speed</GuideBadge>
                  <span className="ml-2">Controls how fast playback advances (Fast, Normal, Slow).</span>
                </p>
                <p>
                  <GuideBadge>AI Explain</GuideBadge>
                  <span className="ml-2">Requests a full-code explanation from the AI service.</span>
                </p>
              </GuideSection>

              <GuideSection title="Source Code Panel">
                <p>The highlighted line is the line about to execute at the current step.</p>
                <p>The editor auto-scrolls to keep the active line visible during playback.</p>
              </GuideSection>

              <GuideSection title="Memory Panel">
                <p>Table view shows stack variables for the current function and heap objects for C.</p>
                <p>Changed values are highlighted so you can see what just happened.</p>
                <p>Graph view appears for pointer-heavy code and visualizes references.</p>
              </GuideSection>

              <GuideSection title="Explanation Panel">
                <p>Step details summarize what is happening at the current line.</p>
                <p>AI line explanations appear when available and replace the fallback summary.</p>
              </GuideSection>

              <GuideSection title="Bottom-Right Tabs">
                <p>Timeline lets you jump directly to any step.</p>
                <p>Complexity runs an AI estimate of time complexity from the trace.</p>
                <p>AI Chat lets you ask questions about the current program and trace.</p>
              </GuideSection>

              <GuideSection title="Common Issues">
                <p>Compilation errors appear in a red banner with line numbers.</p>
                <p>If AI services time out, try again after a successful trace.</p>
                <p>For large programs, reduce input size to keep traces shorter.</p>
              </GuideSection>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default GuideModal;
