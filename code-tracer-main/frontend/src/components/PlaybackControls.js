import React, { useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ArrowCounterClockwise,
  Lightning,
  Brain,
} from '@phosphor-icons/react';
import useTraceStore from '@/store/traceStore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api";

const generateRunId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const isCanceledRequest = (err) => {
  if (!err) return false;
  // Axios v1 uses ERR_CANCELED for AbortController aborts.
  return err.code === 'ERR_CANCELED' || err.name === 'CanceledError';
};

const PlaybackControls = () => {
  const code = useTraceStore((s) => s.code);
  const language = useTraceStore((s) => s.language);
  const steps = useTraceStore((s) => s.steps);
  const currentStep = useTraceStore((s) => s.currentStep);
  const isPlaying = useTraceStore((s) => s.isPlaying);
  const isTracing = useTraceStore((s) => s.isTracing);
  const playSpeed = useTraceStore((s) => s.playSpeed);
  const setSteps = useTraceStore((s) => s.setSteps);
  const setIsTracing = useTraceStore((s) => s.setIsTracing);
  const setActiveRun = useTraceStore((s) => s.setActiveRun);
  const clearActiveRun = useTraceStore((s) => s.clearActiveRun);
  const setTraceError = useTraceStore((s) => s.setTraceError);
  const setCompilationError = useTraceStore((s) => s.setCompilationError);
  const setTraceSummary = useTraceStore((s) => s.setTraceSummary);
  const setAiExplanation = useTraceStore((s) => s.setAiExplanation);
  const setAiExplanationLoading = useTraceStore((s) => s.setAiExplanationLoading);
  const setAiComplexity = useTraceStore((s) => s.setAiComplexity);
  const play = useTraceStore((s) => s.play);
  const pause = useTraceStore((s) => s.pause);
  const stepForward = useTraceStore((s) => s.stepForward);
  const stepBackward = useTraceStore((s) => s.stepBackward);
  const reset = useTraceStore((s) => s.reset);
  const aiExplanationLoading = useTraceStore((s) => s.aiExplanationLoading);
  const executionStatus = useTraceStore((s) => s.executionStatus);

  const intervalRef = useRef(null);

  const cancelTrace = useCallback(async () => {
    const store = useTraceStore.getState();
    const runId = store.activeRunId;
    const controller = store.activeRunAbortController;

    // Stop the in-flight HTTP request immediately.
    if (controller) {
      try { controller.abort(); } catch { /* noop */ }
    }

    // Best-effort server-side cancellation (kills the sandbox container).
    if (runId) {
      try {
        await axios.post(`${API}/cancel`, { run_id: runId }, { timeout: 5000 });
      } catch {
        // best-effort
      }
    }

    // Update UI state immediately; don't clear steps/output.
    store.setExecutionStatus('idle');
    setIsTracing(false);
    clearActiveRun(runId);
  }, [clearActiveRun, setIsTracing]);

  // Build trace summary after successful trace
  const buildSummary = useCallback(async (traceSteps) => {
    if (!traceSteps || traceSteps.length === 0) return;
    try {
      const res = await axios.post(`${API}/ai/summarize`, {
        code,
        steps: traceSteps,
      }, { timeout: 10000 });
      if (res.data.trace_summary) {
        setTraceSummary(res.data.trace_summary);
      }
    } catch {
      // Summary is best-effort, don't block on failure
    }
  }, [code, setTraceSummary]);

  // ── Run code (supports multi-phase input execution) ──
  const runTrace = useCallback(async (inputsOverride) => {
    const store = useTraceStore.getState();
    const inputs = inputsOverride !== undefined ? inputsOverride : store.collectedInputs;

    const runId = generateRunId();
    const controller = new AbortController();
    setActiveRun(runId, controller);

    setIsTracing(true);
    store.setExecutionStatus('running');

    // Only clear AI state on first run (no inputs yet)
    if (inputs.length === 0) {
      setTraceError(null);
      setCompilationError(null);
      setAiExplanation(null);
      setAiComplexity(null);
      setTraceSummary(null);
      store.clearInputState();
    }

    try {
      const res = await axios.post(
        `${API}/run`,
        { code, language, inputs, run_id: runId },
        { timeout: 120000, signal: controller.signal },
      );

      if (res.data.status === 'canceled') {
        store.setExecutionStatus('idle');
        return;
      }

      if (res.data.compilation_error) {
        setSteps([], '');
        setCompilationError(res.data.compilation_error);
        store.setExecutionStatus('error');
      } else if (res.data.error) {
        setSteps(res.data.steps || [], res.data.final_output || '');
        setTraceError(res.data.error);
        store.setExecutionStatus('error');
      } else if (res.data.status === 'waiting_for_input') {
        // Program needs input — show partial steps and pause
        const traceSteps = res.data.steps || [];
        setSteps(traceSteps, res.data.final_output || '');

        // Gather stdout from multiple sources (GDB MI may miss it on some systems)
        let stdoutAtPause = res.data.stdout_at_pause || '';
        if (!stdoutAtPause.trim() && res.data.final_output) {
          stdoutAtPause = res.data.final_output;
        }
        // Fallback: check the last step's captured stdout
        if (!stdoutAtPause.trim() && traceSteps.length > 0) {
          const lastStepStdout = traceSteps[traceSteps.length - 1]?.stdout || '';
          if (lastStepStdout.trim()) stdoutAtPause = lastStepStdout;
        }

        // Compute new output (diff from what was already shown)
        const existingOutput = store.outputHistory
          .filter(e => e.type === 'output')
          .map(e => e.text)
          .join('');
        const newOutput = stdoutAtPause.startsWith(existingOutput)
          ? stdoutAtPause.slice(existingOutput.length)
          : (stdoutAtPause && stdoutAtPause !== existingOutput ? stdoutAtPause : '');

        if (newOutput) {
          store.appendOutputHistory({ type: 'output', text: newOutput });
        }
        store.appendOutputHistory({ type: 'system', text: 'Program waiting for input...' });
        store.setExecutionStatus('paused_for_input');
        store.showInputPrompt();

        // Switch to output tab so user sees the prompt
        store.setActiveEditorTab('output');
      } else {
        // Execution completed successfully
        const traceSteps = res.data.steps || [];
        setSteps(traceSteps, res.data.final_output || '');
        store.setExecutionStatus('completed');

        // Add final output to history
        const finalOut = res.data.final_output || '';
        const existingOutput = store.outputHistory
          .filter(e => e.type === 'output')
          .map(e => e.text)
          .join('');
        const newOutput = finalOut.startsWith(existingOutput)
          ? finalOut.slice(existingOutput.length)
          : (finalOut && !existingOutput ? finalOut : '');

        if (newOutput) {
          store.appendOutputHistory({ type: 'output', text: newOutput });
        }

        // Build AI summary in background
        buildSummary(traceSteps);
      }
    } catch (err) {
      if (isCanceledRequest(err)) {
        store.setExecutionStatus('idle');
        return;
      }
      setTraceError(err.message || 'Failed to run code');
      store.setExecutionStatus('error');
    } finally {
      setIsTracing(false);
      clearActiveRun(runId);
    }
  }, [code, language, setIsTracing, setActiveRun, clearActiveRun, setTraceError, setCompilationError, setSteps, setAiExplanation, setAiComplexity, setTraceSummary, buildSummary]);

  // ── Initial run (no inputs) ──
  const handleRun = useCallback(async () => {
    // Fresh run — clear previous inputs
    useTraceStore.getState().clearInputState();
    await runTrace([]);
  }, [runTrace]);

  const handleRunOrCancel = useCallback(async () => {
    if (useTraceStore.getState().isTracing) {
      await cancelTrace();
      return;
    }
    await handleRun();
  }, [cancelTrace, handleRun]);

  // AI Explain button handler
  const handleExplain = useCallback(async () => {
    const traceSummary = useTraceStore.getState().traceSummary;
    setAiExplanationLoading(true);
    try {
      const res = await axios.post(`${API}/ai/explain`, {
        code,
        language,
        trace_summary: traceSummary,
      }, { timeout: 120000 });
      setAiExplanation(res.data.explanation || 'No explanation available.');
    } catch (err) {
      setAiExplanation(`Error: ${err.message || 'Failed to get explanation'}`);
    } finally {
      setAiExplanationLoading(false);
    }
  }, [code, language, setAiExplanation, setAiExplanationLoading]);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        const state = useTraceStore.getState();
        if (state.currentStep >= state.steps.length - 1 ||
            state.executionStatus === 'paused_for_input') {
          useTraceStore.getState().pause();
        } else {
          useTraceStore.getState().stepForward();
        }
      }, playSpeed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playSpeed]);

  const hasSteps = steps.length > 0;
  const atStart = currentStep <= 0;
  const atEnd = steps.length <= 1 || currentStep >= steps.length - 1;
  const isPausedForInput = executionStatus === 'paused_for_input';
  const runTooltip = isTracing
    ? 'Cancel Run & Trace'
    : (isPausedForInput ? 'Re-run (clear inputs)' : 'Run & Trace');

  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-testid="playback-controls"
        className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 bg-zinc-800/60 border border-zinc-700/30 rounded-full"
      >
        {/* Run button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="run-button"
              variant="ghost"
              size="icon"
              onClick={handleRunOrCancel}
              aria-label={runTooltip}
              className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full text-zinc-400 ${
                isTracing
                  ? 'hover:bg-red-500/20 hover:text-red-400'
                  : 'hover:bg-emerald-500/20 hover:text-emerald-400'
              } ${
                isPausedForInput ? 'ring-2 ring-amber-400/50 animate-pulse' : ''
              }`}
            >
              <Lightning size={14} weight="fill" className={isTracing ? 'animate-spin' : ''} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{runTooltip}</TooltipContent>
        </Tooltip>

        <div className="w-px h-3 sm:h-4 bg-zinc-700/40" />

        {/* Reset */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="reset-button"
              variant="ghost"
              size="icon"
              onClick={reset}
              disabled={!hasSteps}
              aria-label="Reset execution"
              className="h-5 w-5 sm:h-6 sm:w-6 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
            >
              <ArrowCounterClockwise size={11} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset</TooltipContent>
        </Tooltip>

        {/* Step Back */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="step-backward-button"
              variant="ghost"
              size="icon"
              onClick={stepBackward}
              disabled={!hasSteps || atStart}
              aria-label="Step backward"
              className="h-5 w-5 sm:h-6 sm:w-6 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
            >
              <SkipBack size={11} weight="fill" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Step Back</TooltipContent>
        </Tooltip>

        {/* Play / Pause */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="play-pause-button"
              variant="ghost"
              size="icon"
              onClick={isPlaying ? pause : play}
              disabled={!hasSteps || (!isPlaying && atEnd)}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300"
            >
              {isPlaying ? (
                <Pause size={13} weight="fill" />
              ) : (
                <Play size={13} weight="fill" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isPlaying ? 'Pause' : 'Play'}</TooltipContent>
        </Tooltip>

        {/* Step Forward */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="step-forward-button"
              variant="ghost"
              size="icon"
              onClick={stepForward}
              disabled={!hasSteps || atEnd}
              aria-label="Step forward"
              className="h-5 w-5 sm:h-6 sm:w-6 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
            >
              <SkipForward size={11} weight="fill" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Step Forward</TooltipContent>
        </Tooltip>

        {/* Step counter + speed — hide speed label on small screens */}
        {hasSteps && (
          <>
            <div className="w-px h-3 sm:h-4 bg-zinc-700/40" />
            <span data-testid="step-counter" className="text-[9px] sm:text-[10px] font-mono text-zinc-400 min-w-[32px] sm:min-w-[40px] text-center">
              {currentStep + 1}/{steps.length}
            </span>
            <select
              data-testid="speed-selector"
              value={playSpeed}
              onChange={(e) => useTraceStore.getState().setPlaySpeed(Number(e.target.value))}
              aria-label="Playback speed"
              className="hidden sm:inline bg-transparent text-[10px] font-mono text-zinc-500 outline-none cursor-pointer"
            >
              <option value={300} className="bg-zinc-900">Fast</option>
              <option value={700} className="bg-zinc-900">Normal</option>
              <option value={1200} className="bg-zinc-900">Slow</option>
            </select>
          </>
        )}

        {/* AI Explain button */}
        <div className="w-px h-3 sm:h-4 bg-zinc-700/40" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="ai-explain-button"
              variant="ghost"
              size="icon"
              onClick={handleExplain}
              disabled={aiExplanationLoading}
              aria-label="AI Explain Code"
              className="h-6 w-6 sm:h-7 sm:w-7 rounded-full hover:bg-violet-500/20 hover:text-violet-400 text-zinc-400"
            >
              <Brain size={14} weight={aiExplanationLoading ? 'fill' : 'regular'} className={aiExplanationLoading ? 'animate-pulse' : ''} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>AI Explain Code</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

// Export runTrace for use by other components (e.g., CodeEditor input submit)
export { API };
export default PlaybackControls;
