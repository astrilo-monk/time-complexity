import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import useTraceStore from '@/store/traceStore';
import MobileEditorToolbar from '@/components/MobileEditorToolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  return err.code === 'ERR_CANCELED' || err.name === 'CanceledError';
};

/* ── Terminal-like Output Tab ─────────────────────────────────────── */
const TerminalOutput = () => {
  const outputHistory = useTraceStore((s) => s.outputHistory);
  const inputPromptVisible = useTraceStore((s) => s.inputPromptVisible);
  const executionStatus = useTraceStore((s) => s.executionStatus);
  const isTracing = useTraceStore((s) => s.isTracing);
  const compilationError = useTraceStore((s) => s.compilationError);
  const traceError = useTraceStore((s) => s.traceError);
  const steps = useTraceStore((s) => s.steps);
  const finalOutput = useTraceStore((s) => s.finalOutput);

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-focus the input field when it appears
  useEffect(() => {
    if (inputPromptVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputPromptVisible]);

  // Auto-scroll to bottom when new entries appear
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      // Slight delay to ensure DOM has updated
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [outputHistory, inputPromptVisible]);

  // Submit input handler
  const handleSubmitInput = useCallback(async (value) => {
    if (!value.trim() && value !== '') return; // allow empty string but not whitespace-only
    const store = useTraceStore.getState();
    // Guard against double-submission while already re-tracing
    if (store.executionStatus === 'running' || store.isTracing) return;
    // Record the input
    store.addInput(value);
    setInputValue('');

    // Re-run trace with accumulated inputs
    const updatedInputs = [...store.collectedInputs]; // addInput already added it
    store.setExecutionStatus('running');
    store.appendOutputHistory({ type: 'system', text: 'Resuming execution...' });

    const code = store.code;
    const language = store.language;

    const runId = generateRunId();
    const controller = new AbortController();
    store.setActiveRun(runId, controller);

    try {
      useTraceStore.getState().setIsTracing(true);
      const res = await axios.post(`${API}/run`, {
        code,
        language,
        inputs: updatedInputs,
        run_id: runId,
      }, { timeout: 120000, signal: controller.signal });

      if (res.data.status === 'canceled') {
        store.setExecutionStatus('idle');
        return;
      }

      if (res.data.compilation_error) {
        store.setSteps([], '');
        store.setCompilationError(res.data.compilation_error);
        store.setExecutionStatus('error');
      } else if (res.data.error) {
        store.setSteps(res.data.steps || [], res.data.final_output || '');
        store.setTraceError(res.data.error);
        store.setExecutionStatus('error');
      } else if (res.data.status === 'waiting_for_input') {
        // Still needs more input
        const traceSteps = res.data.steps || [];
        store.setSteps(traceSteps, res.data.final_output || '');
        
        let stdoutAtPause = res.data.stdout_at_pause || '';
        if (!stdoutAtPause.trim() && res.data.final_output) {
          stdoutAtPause = res.data.final_output;
        }
        if (!stdoutAtPause.trim() && traceSteps.length > 0) {
          const lastStepStdout = traceSteps[traceSteps.length - 1]?.stdout || '';
          if (lastStepStdout.trim()) stdoutAtPause = lastStepStdout;
        }

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
      } else {
        // Execution completed
        const traceSteps = res.data.steps || [];
        store.setSteps(traceSteps, res.data.final_output || '');
        store.setExecutionStatus('completed');

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
        store.appendOutputHistory({ type: 'system', text: '✓ Program completed.' });
      }
    } catch (err) {
      if (isCanceledRequest(err)) {
        store.setExecutionStatus('idle');
        return;
      }
      store.setTraceError(err.message || 'Failed to run code');
      store.setExecutionStatus('error');
    } finally {
      useTraceStore.getState().setIsTracing(false);
      store.clearActiveRun(runId);
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitInput(inputValue);
    }
  };

  // Determine what to show:
  // 1. If we have outputHistory entries (active input session) → show terminal
  // 2. Otherwise → show legacy static output
  const hasTerminalSession = outputHistory.length > 0 || executionStatus === 'paused_for_input';

  // Legacy output (for runs without input)
  const currentState = useTraceStore((s) => s.steps[s.currentStep]) || null;
  const legacyOutput = useMemo(() => {
    const stepStdout = currentState?.stdout || '';
    if (stepStdout && stepStdout.trim().length > 0) return stepStdout;
    const latestStdout = [...steps]
      .reverse()
      .map((step) => step?.stdout || '')
      .find((text) => text && text.trim().length > 0);
    if (latestStdout) return latestStdout;
    return finalOutput || '';
  }, [currentState, finalOutput, steps]);

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-1.5">
          {/* Errors */}
          {compilationError && (
            <div className="rounded border border-red-500/25 bg-red-500/5 px-3 py-2 text-[11px] font-mono text-red-300 whitespace-pre-wrap">
              {compilationError}
            </div>
          )}
          {traceError && !compilationError && (
            <div className="rounded border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] font-mono text-amber-300 whitespace-pre-wrap">
              {traceError}
            </div>
          )}

          {/* Terminal session (input-aware) */}
          {hasTerminalSession ? (
            <>
              {outputHistory.map((entry, i) => (
                <div key={i} className={`text-xs font-mono whitespace-pre-wrap leading-relaxed ${
                  entry.type === 'output' ? 'text-zinc-200' :
                  entry.type === 'input' ? 'text-emerald-400' :
                  'text-amber-400/70 text-[10px] italic'
                }`}>
                  {entry.type === 'input' ? `› ${entry.text}` : entry.text}
                </div>
              ))}

              {/* Inline input field */}
              {inputPromptVisible && !isTracing && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-emerald-400 text-xs font-mono font-bold animate-pulse">›</span>
                  <input
                    ref={inputRef}
                    data-testid="runtime-input-field"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type input and press Enter..."
                    className="flex-1 bg-zinc-800/60 border border-emerald-500/30 rounded px-2 py-1.5 text-xs font-mono text-zinc-100 outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/20 placeholder:text-zinc-600 transition-all"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button
                    data-testid="submit-input-button"
                    onClick={() => handleSubmitInput(inputValue)}
                    disabled={isTracing}
                    className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[10px] font-plex uppercase tracking-wider rounded border border-emerald-500/30 hover:border-emerald-400/50 transition-all disabled:opacity-40"
                  >
                    Submit
                  </button>
                </div>
              )}

              {/* Loading indicator during re-execution */}
              {isTracing && executionStatus === 'running' && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[10px] font-plex text-amber-400 animate-pulse">
                    Re-tracing with input...
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Legacy static output (no input session) */
            <>
              {legacyOutput ? (
                <pre className="text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {legacyOutput}
                </pre>
              ) : (
                <div className="text-xs font-plex text-zinc-500">
                  {steps.length > 0 ? 'No output captured for this run.' : 'Run code to see output here.'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};


const CodeEditor = () => {
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);
  const language = useTraceStore((s) => s.language);
  const setLanguage = useTraceStore((s) => s.setLanguage);
  const code = useTraceStore((s) => s.code);
  const setCode = useTraceStore((s) => s.setCode);
  const steps = useTraceStore((s) => s.steps);
  const currentStep = useTraceStore((s) => s.currentStep);
  const isTracing = useTraceStore((s) => s.isTracing);
  const activeEditorTab = useTraceStore((s) => s.activeEditorTab);
  const setActiveEditorTab = useTraceStore((s) => s.setActiveEditorTab);
  const setEditorInstance = useTraceStore((s) => s.setEditorInstance);
  const executionStatus = useTraceStore((s) => s.executionStatus);

  const currentState = steps[currentStep] || null;
  const activeLine = currentState?.line || 0;

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    setEditorInstance(editor);

    // Define custom theme
    monaco.editor.defineTheme('ctrace-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A737D' },
        { token: 'keyword', foreground: '3B82F6' },
        { token: 'string', foreground: '10B981' },
        { token: 'number', foreground: 'F59E0B' },
        { token: 'type', foreground: '8B5CF6' },
      ],
      colors: {
        'editor.background': '#0C0C0E',
        'editor.foreground': '#FAFAFA',
        'editor.lineHighlightBackground': '#18181B',
        'editor.selectionBackground': '#3B82F633',
        'editorCursor.foreground': '#3B82F6',
        'editorLineNumber.foreground': '#52525B',
        'editorLineNumber.activeForeground': '#A1A1AA',
        'editor.inactiveSelectionBackground': '#27272A',
      },
    });
    monaco.editor.setTheme('ctrace-dark');
  };

  // Highlight active line
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const monaco = window.monaco;
    if (!monaco) return;

    if (activeLine <= 0) {
      // Clear decorations when no trace
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }

    const newDecorations = [
      {
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: 'active-line-decoration',
          glyphMarginClassName: 'active-line-glyph',
        },
      },
    ];

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );

    // Scroll to active line
    editor.revealLineInCenter(activeLine);
  }, [activeLine]);

  const isPausedForInput = executionStatus === 'paused_for_input';

  return (
    <div data-testid="code-editor-panel" className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => setActiveEditorTab('source')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1 text-[9px] sm:text-[10px] font-plex tracking-[0.12em] uppercase transition-all duration-200 border-b-2 ${
                activeEditorTab === 'source'
                  ? 'text-blue-300 border-blue-500 bg-blue-500/5'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}
            >
              Source
            </button>
            <button
              type="button"
              onClick={() => setActiveEditorTab('output')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1 text-[9px] sm:text-[10px] font-plex tracking-[0.12em] uppercase transition-all duration-200 border-b-2 relative ${
                activeEditorTab === 'output'
                  ? 'text-blue-300 border-blue-500 bg-blue-500/5'
                  : isPausedForInput
                    ? 'text-amber-400 border-amber-400 bg-amber-400/5 animate-pulse'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}
            >
              Output
              {isPausedForInput && activeEditorTab !== 'output' && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
          </div>
          {isTracing && (
            <span className="text-[10px] font-plex text-amber-400 animate-pulse">Tracing...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="language-selector"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isTracing}
            className="bg-zinc-900/70 border border-zinc-700/50 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-300 outline-none"
          >
            <option value="c">C</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
          </select>
          <span className="text-[10px] font-mono text-zinc-600">
            {language === 'java' ? 'Main.java' : language === 'python' ? 'program.py' : 'program.c'}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {activeEditorTab === 'source' ? (
          <Editor
            height="100%"
            language={language === 'java' ? 'java' : language === 'python' ? 'python' : 'c'}
            value={code}
            onChange={(val) => setCode(val || '')}
            onMount={handleEditorDidMount}
            options={{
              fontSize: window.innerWidth < 768 ? 11 : (window.innerWidth < 1024 ? 12 : 13),
              fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              renderLineHighlight: 'none',
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                vertical: 'auto',
                horizontal: 'hidden',
              },
              readOnly: isTracing,
              wordWrap: 'on',
              automaticLayout: true,
            }}
            loading={
              <div className="h-full flex items-center justify-center text-zinc-600 text-sm font-plex">
                Loading editor...
              </div>
            }
          />
        ) : (
          <TerminalOutput />
        )}
      </div>
      {activeEditorTab === 'source' && <MobileEditorToolbar />}
    </div>
  );
};

export default CodeEditor;
