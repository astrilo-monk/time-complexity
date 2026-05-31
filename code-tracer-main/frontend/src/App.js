import React, { useState, Suspense, lazy } from 'react';
import { Analytics } from '@vercel/analytics/react';
import '@/App.css';
import PlaybackControls from '@/components/PlaybackControls';
import GuideModal from '@/components/GuideModal';
import useTraceStore from '@/store/traceStore';
import { Terminal, Warning, Info, X, Clock, ChartBar, ChatCircleDots, BookOpen } from '@phosphor-icons/react';
import SEO from '@/components/SEO';
import SeoContent from '@/components/SeoContent';

const CodeEditor = lazy(() => import('@/components/CodeEditor'));
const ExplanationPanel = lazy(() => import('@/components/ExplanationPanel'));
const MemoryVisualization = lazy(() => import('@/components/MemoryVisualization'));
const StepTimeline = lazy(() => import('@/components/StepTimeline'));
const ComplexityPanel = lazy(() => import('@/components/ComplexityPanel'));
const AiChatPanel = lazy(() => import('@/components/AiChatPanel'));

const LoaderFallback = () => (
  <div className="w-full h-full flex items-center justify-center bg-zinc-950/50">
    <span className="text-zinc-500 text-[10px] font-mono tracking-widest uppercase animate-pulse">Loading...</span>
  </div>
);

const ErrorBanner = () => {
  const compilationError = useTraceStore((s) => s.compilationError);
  const traceError = useTraceStore((s) => s.traceError);
  const setTraceError = useTraceStore((s) => s.setTraceError);
  const setCompilationError = useTraceStore((s) => s.setCompilationError);
  const error = compilationError || traceError;
  if (!error) return null;

  const dismiss = () => {
    setTraceError(null);
    setCompilationError(null);
  };

  // Parse line numbers from GCC/Javac errors
  const lines = error.split('\n').filter(Boolean);

  return (
    <div data-testid="error-banner" className="fixed top-0 left-0 right-0 z-50 bg-red-950/95 border-b border-red-500/30 backdrop-blur-sm">
      <div className="px-4 py-2 max-h-40 overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Warning size={14} className="text-red-400 shrink-0" weight="fill" />
            <span className="text-[10px] font-plex tracking-[0.15em] uppercase text-red-400">
              {compilationError ? 'Compilation Error' : 'Trace Error'}
            </span>
          </div>
          <button
            data-testid="error-dismiss"
            onClick={dismiss}
            className="p-0.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
        {lines.map((line, i) => {
          const match = line.match(/(?:program\.c|program\.py|[A-Za-z_][A-Za-z0-9_]*\.java):(\d+)(?::\d+)?:\s*(error|warning):\s*(.*)/);
          if (match) {
            return (
              <div key={i} className="flex items-start gap-2 py-0.5">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                  match[2] === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  Line {match[1]}
                </span>
                <span className="text-xs font-mono text-red-300">{match[3]}</span>
              </div>
            );
          }
          return <pre key={i} className="text-xs font-mono text-red-300/70">{line}</pre>;
        })}
      </div>
    </div>
  );
};

const SupportedFeatures = () => (
  <div data-testid="supported-features" className="hidden sm:flex items-center gap-3 text-[10px] font-plex text-zinc-600">
    <Info size={12} className="text-zinc-600 shrink-0" />
    <span>Supports C, Java + Python tracing (core control flow, stack, locals)</span>
  </div>
);

/* ── Tabbed bottom-right panel: Timeline | Complexity | AI Chat ──── */
const TAB_CONFIG = [
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'complexity', label: 'Complexity', icon: ChartBar },
  { id: 'chat', label: 'AI Chat', icon: ChatCircleDots },
];

const BottomRightPanel = () => {
  const activeAiTab = useTraceStore((s) => s.activeAiTab);
  const setActiveAiTab = useTraceStore((s) => s.setActiveAiTab);

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center border-b border-zinc-800/60 bg-zinc-950/50">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAiTab === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveAiTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 text-[9px] sm:text-[10px] font-plex tracking-[0.12em] uppercase transition-all duration-200 border-b-2 ${
                isActive
                  ? 'text-blue-300 border-blue-500 bg-blue-500/5'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}
            >
              <Icon size={12} weight={isActive ? 'fill' : 'regular'} />
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Tab content */}
      <div className="flex-1 min-h-0 relative">
        <Suspense fallback={<LoaderFallback />}>
          {activeAiTab === 'timeline' && <StepTimeline />}
          {activeAiTab === 'complexity' && <ComplexityPanel />}
          {activeAiTab === 'chat' && <AiChatPanel />}
        </Suspense>
      </div>
    </div>
  );
};

function App() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="app-root dark">
      <SEO />
      <Analytics />
      <ErrorBanner />
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Header */}
      <header data-testid="app-header" className="app-header">
        <div className="flex items-center gap-2.5 shrink-0">
          <Terminal size={18} weight="bold" className="text-blue-400" />
          <h1 className="text-sm font-cabinet font-bold tracking-tight text-zinc-100">
            Code Tracer
          </h1>
          <SupportedFeatures />
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <PlaybackControls />
          <button
            type="button"
            data-testid="guide-button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-plex uppercase tracking-[0.12em] bg-zinc-800/60 text-zinc-300 border border-zinc-700/40 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all"
          >
            <BookOpen size={12} weight="fill" className="text-blue-400" />
            Guide
          </button>
        </div>
      </header>

      {/* 4-Quadrant Grid: Editor | Memory, Explanation | Timeline/Complexity/Chat */}
      <main data-testid="main-grid" className="app-grid">
        <section aria-label="Code Editor" className="quadrant border-r border-b border-zinc-800/60 relative">
          <Suspense fallback={<LoaderFallback />}>
            <CodeEditor />
          </Suspense>
        </section>
        <section aria-label="Memory Visualization" className="quadrant border-b border-zinc-800/60 relative">
          <Suspense fallback={<LoaderFallback />}>
            <MemoryVisualization />
          </Suspense>
        </section>
        <section aria-label="Explanation Panel" className="quadrant border-r border-zinc-800/60 relative">
          <Suspense fallback={<LoaderFallback />}>
            <ExplanationPanel />
          </Suspense>
        </section>
        <section aria-label="Analysis Tools" className="quadrant relative">
          <BottomRightPanel />
        </section>
      </main>

      {/* SEO On-Page Content (Features & FAQ) */}
      <SeoContent />
    </div>
  );
}

export default App;
