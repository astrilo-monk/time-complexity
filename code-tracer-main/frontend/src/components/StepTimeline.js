import React, { useRef, useEffect, useMemo } from 'react';
import useTraceStore from '@/store/traceStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CaretRight } from '@phosphor-icons/react';
import { getStepTransitionType } from '@/lib/frameDiff';

const StepTimeline = () => {
  const steps = useTraceStore((s) => s.steps);
  const currentStep = useTraceStore((s) => s.currentStep);
  const setCurrentStep = useTraceStore((s) => s.setCurrentStep);
  const code = useTraceStore((s) => s.code);
  const beginnerMode = useTraceStore((s) => s.beginnerMode);
  const pause = useTraceStore((s) => s.pause);
  const activeRef = useRef(null);

  const lines = code.split('\n');

  // Pre-compute transition types for all steps
  const transitionTypes = useMemo(() => {
    return steps.map((step, i) => {
      const prev = i > 0 ? steps[i - 1] : null;
      return getStepTransitionType(step, prev);
    });
  }, [steps]);

  // Auto-scroll to active step
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStep]);

  const handleStepClick = (i) => {
    pause();
    setCurrentStep(i);
  };

  return (
    <div data-testid="step-timeline" className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <span className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">
          Timeline
        </span>
        {steps.length > 0 && (
          <span className="text-[10px] font-mono text-zinc-600">
            {steps.length} steps
          </span>
        )}
      </div>
      <ScrollArea className="flex-1">
        {steps.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600 font-plex text-center">
            Run code to see execution timeline
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {steps.map((step, i) => {
              const isActive = i === currentStep;
              const isPast = i < currentStep;
              const lineText = (lines[step.line - 1] || '').trim();
              const truncated = lineText.length > 40 ? lineText.slice(0, 40) + '...' : lineText;
              const tt = transitionTypes[i];

              return (
                <button
                  key={i}
                  ref={isActive ? activeRef : null}
                  data-testid={`timeline-step-${i}`}
                  onClick={() => handleStepClick(i)}
                  className={`w-full text-left px-3 py-2 rounded flex items-start gap-2.5 transition-all duration-150 group ${
                    isActive
                      ? 'bg-blue-500/10 border border-blue-500/30'
                      : isPast
                        ? 'hover:bg-zinc-900/60 opacity-60 hover:opacity-80'
                        : 'hover:bg-zinc-900/60 opacity-40 hover:opacity-70'
                  }`}
                >
                  {/* Step number dot */}
                  <div className="flex flex-col items-center pt-0.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-semibold shrink-0 ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : isPast
                          ? 'bg-zinc-700 text-zinc-400'
                          : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      {i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`w-px h-3 mt-0.5 ${isPast ? 'bg-zinc-700' : 'bg-zinc-800/50'}`} />
                    )}
                  </div>
                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isActive && <CaretRight size={10} className="text-blue-400 shrink-0" weight="bold" />}
                      <span className={`text-[10px] font-mono px-1 rounded ${
                        isActive ? 'text-blue-300 bg-blue-500/10' : 'text-zinc-600'
                      }`}>
                        {step.func}()
                      </span>
                      <span className={`text-[10px] font-mono ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        L{step.line}
                      </span>
                      {/* Call/return badge */}
                      {tt === 'call' && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80">
                          → call
                        </span>
                      )}
                      {tt === 'return' && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-violet-500/10 text-violet-400/80">
                          ← return
                        </span>
                      )}
                    </div>
                    <p className={`text-xs font-mono truncate mt-0.5 ${
                      isActive ? 'text-zinc-200' : 'text-zinc-500'
                    }`}>
                      {truncated}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default StepTimeline;
