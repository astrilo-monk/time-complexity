import React, { useMemo, useEffect, useCallback } from 'react';
import useTraceStore from '@/store/traceStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Code, ArrowBendDownRight, ArrowBendUpLeft, Brain, Sparkle, Lightning } from '@phosphor-icons/react';
import { getFrameScopedChanges, getExplanation, getTransitionMeta } from '@/lib/frameDiff';
import { fetchLineExplanation } from '@/lib/lineExplainer';

const ExplanationPanel = () => {
  const steps = useTraceStore((s) => s.steps);
  const currentStep = useTraceStore((s) => s.currentStep);
  const beginnerMode = useTraceStore((s) => s.beginnerMode);
  const code = useTraceStore((s) => s.code);
  const language = useTraceStore((s) => s.language);
  const aiExplanation = useTraceStore((s) => s.aiExplanation);
  const aiExplanationLoading = useTraceStore((s) => s.aiExplanationLoading);
  const lineExplanations = useTraceStore((s) => s.lineExplanations);
  const lineExplanationLoading = useTraceStore((s) => s.lineExplanationLoading);
  const setLineExplanation = useTraceStore((s) => s.setLineExplanation);
  const setLineExplanationLoading = useTraceStore((s) => s.setLineExplanationLoading);
  const currentState = steps[currentStep] || null;

  const explanation = useMemo(() => {
    if (!currentState) return null;
    const prev = currentStep > 0 ? steps[currentStep - 1] : null;
    return getExplanation(currentState, prev, code, beginnerMode);
  }, [currentState, currentStep, steps, code, beginnerMode]);

  const changedVars = useMemo(
    () => getFrameScopedChanges(steps, currentStep),
    [steps, currentStep],
  );

  const transition = useMemo(() => {
    if (!currentState) return null;
    const prev = currentStep > 0 ? steps[currentStep - 1] : null;
    return getTransitionMeta(currentState, prev);
  }, [currentState, currentStep, steps]);

  // Fetch AI line explanation when step changes
  const fetchExplanation = useCallback(async () => {
    if (!currentState || lineExplanations[currentStep] !== undefined) return;

    const lines = code.split('\n');
    const lineText = (lines[currentState.line - 1] || '').trim();
    if (!lineText) return;

    const prev = currentStep > 0 ? steps[currentStep - 1] : null;

    setLineExplanationLoading(currentStep);

    try {
      const text = await fetchLineExplanation({
        code,
        language,
        stepIndex: currentStep,
        lineNumber: currentState.line,
        lineText,
        funcName: currentState.func,
        variables: currentState.variables || [],
        stackDepth: (currentState.stack_frames?.length || 1) - 1,
        prevLine: prev?.line || null,
        prevFunc: prev?.func || null,
      });
      setLineExplanation(currentStep, text || null);
    } catch {
      setLineExplanation(currentStep, null);
    }
  }, [currentStep, currentState, code, language, steps, lineExplanations, setLineExplanation, setLineExplanationLoading]);

  useEffect(() => {
    fetchExplanation();
  }, [fetchExplanation]);

  const currentLineExplanation = lineExplanations[currentStep];
  const isLineExplainLoading = lineExplanationLoading === currentStep;

  return (
    <div data-testid="explanation-panel" className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <span className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">
          {beginnerMode ? 'Explanation' : 'Step Details'}
        </span>
        {currentState && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">
              {currentState.func}()
            </span>
            <span className="text-[10px] font-mono text-zinc-600">
              L{currentState.line}
            </span>
            {(currentState.stack_frames?.length || 0) > 1 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">
                depth:{(currentState.stack_frames?.length || 1) - 1}
              </span>
            )}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        {/* AI Explanation Banner */}
        {(aiExplanation || aiExplanationLoading) && (
          <div className="mx-4 mt-3 mb-1">
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 overflow-hidden">
              <div className="px-3 py-1.5 bg-violet-500/10 flex items-center gap-2 border-b border-violet-500/20">
                <Brain size={12} weight="fill" className="text-violet-400" />
                <span className="text-[10px] font-plex tracking-[0.15em] uppercase text-violet-400">
                  AI Explanation
                </span>
                <Sparkle size={10} weight="fill" className="text-violet-400/50" />
              </div>
              <div className="px-3 py-2.5">
                {aiExplanationLoading ? (
                  <div className="flex items-center gap-2 text-xs text-violet-300/60 font-plex">
                    <div className="w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                    Analyzing code with AI...
                  </div>
                ) : (
                  <p className="text-xs font-plex text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {aiExplanation}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!currentState ? (
          <div className="p-4 text-sm text-zinc-600 font-plex flex flex-col items-center justify-center h-full gap-2">
            <BookOpen size={24} className="text-zinc-700" />
            Run code to see step-by-step explanations
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Function call banner */}
            {explanation?.isCall && (
              <div className="px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs font-plex text-emerald-300 flex items-center gap-2">
                <ArrowBendDownRight size={14} weight="bold" className="text-emerald-400 shrink-0" />
                <span>
                  Entering function <span className="font-mono font-semibold">{currentState.func}()</span>
                  {explanation.depth > 0 && <span className="text-emerald-400/60"> — depth {explanation.depth}</span>}
                  {transition?.isRecursive && <span className="text-emerald-400/60"> (recursive)</span>}
                </span>
              </div>
            )}

            {/* Function return banner */}
            {explanation?.isReturn && (
              <div className="px-3 py-2 rounded bg-violet-500/10 border border-violet-500/20 text-xs font-plex text-violet-300 flex items-center gap-2">
                <ArrowBendUpLeft size={14} weight="bold" className="text-violet-400 shrink-0" />
                <span>
                  Returned to <span className="font-mono font-semibold">{currentState.func}()</span>
                  <span className="text-violet-400/50"> — variables below are {currentState.func}()'s locals</span>
                </span>
              </div>
            )}

            {/* Current line */}
            <div data-testid="explanation-code-line">
              <div className="flex items-center gap-2 mb-1.5">
                <Code size={14} className="text-amber-400" />
                <span className="text-[10px] font-plex tracking-[0.15em] uppercase text-zinc-500">
                  {currentState.func}() — Line {currentState.line}
                </span>
              </div>
              <div className="bg-zinc-900/80 border border-zinc-800/50 rounded px-3 py-2">
                <code className="text-xs font-mono text-amber-300">
                  {explanation?.short || ''}
                </code>
              </div>
            </div>

            {/* AI-powered "What Happens Here" — replaces old "Changes" */}
            <div data-testid="explanation-detail">
              <div className="flex items-center gap-2 mb-1.5">
                <Lightning size={12} weight="fill" className="text-cyan-400" />
                <span className="text-[10px] font-plex tracking-[0.15em] uppercase text-zinc-500">
                  What Happens Here
                </span>
              </div>
              <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 px-3 py-2.5">
                {isLineExplainLoading ? (
                  <div className="flex items-center gap-2 text-xs text-cyan-300/60 font-plex">
                    <div className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                    Understanding this line...
                  </div>
                ) : currentLineExplanation ? (
                  <p className="text-sm font-plex text-zinc-200 leading-relaxed">
                    {currentLineExplanation}
                  </p>
                ) : (
                  /* Fallback: static explanation from frameDiff */
                  <p className="text-sm font-plex text-zinc-300 leading-relaxed">
                    {explanation?.detail || 'About to execute this line.'}
                  </p>
                )}
              </div>
            </div>

            {/* Updated variables — frame-scoped */}
            {currentState.variables.length > 0 && (
              <div data-testid="explanation-variables">
                <span className="text-[10px] font-plex tracking-[0.15em] uppercase text-zinc-500 mb-1.5 block">
                  {explanation?.isCall ? `Variables (${currentState.func} scope)` :
                   explanation?.isReturn ? `Variables (restored ${currentState.func} scope)` :
                   'Variables'}
                </span>
                <div className="space-y-1">
                  {currentState.variables.map((v, i) => {
                    const isChanged = changedVars.has(v.name);
                    return (
                      <div
                        key={`${v.name}-${i}`}
                        data-testid={`explanation-var-${v.name}`}
                        className={`flex items-center justify-between px-3 py-1.5 rounded text-xs font-mono transition-all duration-300 ${
                          isChanged
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                            : 'bg-zinc-900/40 text-zinc-400'
                        }`}
                      >
                        <span className="text-blue-300">{v.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 text-[10px]">{v.type}</span>
                          <span className={isChanged ? 'text-amber-300 font-semibold' : 'text-zinc-300'}>
                            {v.value || '?'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ExplanationPanel;
