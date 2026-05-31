import React, { useMemo, useState } from 'react';
import useTraceStore from '@/store/traceStore';
import { getFrameScopedChanges, getTransitionMeta } from '@/lib/frameDiff';
import { isPointerType } from '@/lib/pointerGraph';
import PointerGraph from '@/components/PointerGraph';

const MemoryVisualization = () => {
  const steps = useTraceStore((s) => s.steps);
  const currentStep = useTraceStore((s) => s.currentStep);
  const currentState = steps[currentStep] || null;

  // View toggle: "table" (default stack/heap view) or "graph" (pointer graph)
  const [viewMode, setViewMode] = useState('table');

  const changedVars = useMemo(
    () => getFrameScopedChanges(steps, currentStep),
    [steps, currentStep],
  );

  const transition = useMemo(() => {
    if (!currentState) return null;
    const prev = currentStep > 0 ? steps[currentStep - 1] : null;
    return getTransitionMeta(currentState, prev);
  }, [currentState, currentStep, steps]);

  const variables = useMemo(() => currentState?.variables || [], [currentState]);
  const heap = useMemo(() => currentState?.heap || [], [currentState]);
  const prevVariables = useMemo(() => {
    if (currentStep <= 0) return null;
    return steps[currentStep - 1]?.variables || null;
  }, [steps, currentStep]);

  // Build pointer map: variable name -> address it points to
  const pointerTargets = useMemo(() => {
    const map = {};
    for (const v of variables) {
      if (v.type === 'pointer' && v.value && v.value !== '0x0') {
        map[v.name] = v.value;
      }
    }
    return map;
  }, [variables]);

  // Check if any pointer-type variables exist (to show graph toggle)
  const hasPointers = useMemo(
    () => variables.some(v => isPointerType(v.type)),
    [variables],
  );

  if (steps.length === 0) {
    return (
      <div data-testid="memory-visualization" className="h-full flex flex-col">
        <div className="px-4 py-2 border-b border-zinc-800/60">
          <span className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">Memory</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-600 font-plex">
          Run code to visualize memory
        </div>
      </div>
    );
  }

  return (
    <div data-testid="memory-visualization" className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <span className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">Memory</span>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Legend dots */}
          <span className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] text-zinc-600">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500" /> Stack
          </span>
          <span className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] text-zinc-600">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500" /> Pointer
          </span>

          {/* View mode toggle — only show if pointers exist */}
          {hasPointers && (
            <div className="flex items-center gap-0.5 bg-zinc-800/60 rounded-full p-0.5 border border-zinc-700/30">
              <button
                data-testid="view-mode-table"
                onClick={() => setViewMode('table')}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] font-plex font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Table
              </button>
              <button
                data-testid="view-mode-graph"
                onClick={() => setViewMode('graph')}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] font-plex font-medium transition-all ${
                  viewMode === 'graph'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Graph
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Graph view */}
      {viewMode === 'graph' && hasPointers ? (
        <div className="flex-1 min-h-0">
          <PointerGraph memory={variables} prevMemory={prevVariables} />
        </div>
      ) : (
        /* Table view (original) */
        <div className="flex-1 overflow-auto p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-10">
            {/* Stack column */}
            <div className="flex-1">
              <div className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-600 mb-3">Stack</div>

              {/* Frame transition indicator */}
              {transition?.isCall && (
                <div className="mb-2 px-2 py-1.5 rounded bg-emerald-500/5 border border-emerald-500/15 text-[10px] font-plex text-emerald-400/80 flex items-center gap-1.5">
                  <span>↳</span>
                  <span>Entered <span className="font-mono font-medium">{currentState.func}()</span> scope</span>
                </div>
              )}
              {transition?.isReturn && (
                <div className="mb-2 px-2 py-1.5 rounded bg-violet-500/5 border border-violet-500/15 text-[10px] font-plex text-violet-400/80 flex items-center gap-1.5">
                  <span>↲</span>
                  <span>Returned to <span className="font-mono font-medium">{currentState.func}()</span> scope</span>
                </div>
              )}

              <div className="space-y-2">
                {variables.map((v, i) => {
                  const isChanged = changedVars.has(v.name);
                  const isPointer = v.type === 'pointer';
                  const targetAddr = pointerTargets[v.name];
                  return (
                    <div
                      key={`${v.name}-${i}`}
                      data-testid={`mem-var-${v.name}`}
                      className={`mem-block transition-all duration-300 ${
                        isChanged ? 'mem-block-changed' : ''
                      } ${isPointer ? 'mem-block-pointer' : 'mem-block-normal'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="mem-block-name">{v.name}</span>
                          <span className="mem-block-type">{v.type}</span>
                        </div>
                        <span className={`mem-block-value ${isChanged ? 'mem-value-changed' : ''}`}>
                          {v.value || '?'}
                        </span>
                      </div>
                      {isPointer && targetAddr && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500/70 font-mono">
                          <svg width="16" height="8" className="shrink-0">
                            <line x1="0" y1="4" x2="12" y2="4" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6"/>
                            <polygon points="10,1 16,4 10,7" fill="#F59E0B" opacity="0.6"/>
                          </svg>
                          <span className="truncate">{targetAddr}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Heap column */}
            {heap.length > 0 && (
              <div className="flex-1">
                <div className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-600 mb-3">Heap</div>
                <div className="space-y-2">
                  {heap.map((h, i) => (
                    <div
                      key={`heap-${h.address}-${i}`}
                      data-testid={`mem-heap-${h.address}`}
                      className="mem-block mem-block-heap"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-emerald-400">{h.address}</span>
                        <span className="text-[9px] font-plex text-zinc-600">{h.type}</span>
                      </div>
                      {(h.fields || []).map((f, fi) => (
                        <div key={fi} className="flex items-center justify-between text-xs font-mono py-0.5 border-t border-zinc-800/30">
                          <span className="text-zinc-500">{f.name}</span>
                          <span className={f.value?.startsWith('0x') ? 'text-amber-400' : 'text-zinc-200'}>
                            {f.value || '?'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryVisualization;
