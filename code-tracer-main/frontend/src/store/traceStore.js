import { create } from 'zustand';
import { clearLineExplanationCache } from '@/lib/lineExplainer';

const SAMPLE_CODE = `#include <stdio.h>

int add(int a, int b) {
    int sum = a + b;
    return sum;
}

int multiply(int a, int b) {
    int product = a * b;
    return product;
}

int main() {
    int x = 5;
    int y = 3;
    
    int sum = add(x, y);
    int prod = multiply(x, y);
    int total = add(sum, prod);
    
    printf("Result: %d\\n", total);
    return 0;
}`;

  const SAMPLE_JAVA_CODE = `class Main {
    static int add(int a, int b) {
      int sum = a + b;
      return sum;
    }

    static int multiply(int a, int b) {
      int product = a * b;
      return product;
    }

    public static void main(String[] args) {
      int x = 5;
      int y = 3;

      int sum = add(x, y);
      int prod = multiply(x, y);
      int total = add(sum, prod);

      System.out.println("Result: " + total);
    }
  }`;

const SAMPLE_PYTHON_CODE = `def add(a, b):
    total = a + b
    return total

def multiply(a, b):
    product = a * b
    return product

x = 5
y = 3

result_sum = add(x, y)
result_prod = multiply(x, y)
total = add(result_sum, result_prod)

print(f"Result: {total}")`;

const useTraceStore = create((set, get) => ({
  language: 'c',
  code: SAMPLE_CODE,
  setCode: (code) => set({ code }),
  setLanguage: (language) =>
    set(() => ({
      language,
      code: language === 'java' ? SAMPLE_JAVA_CODE : language === 'python' ? SAMPLE_PYTHON_CODE : SAMPLE_CODE,
      steps: [],
      currentStep: 0,
      isPlaying: false,
      activeRunId: null,
      activeRunAbortController: null,
      traceError: null,
      compilationError: null,
      // Reset AI state on language change
      traceSummary: null,
      aiComplexity: null,
      aiExplanation: null,
      aiChatMessages: [],
      // Reset input state on language change
      executionStatus: 'idle',
      collectedInputs: [],
      outputHistory: [],
      inputPromptVisible: false,
    })),

  steps: [],
  finalOutput: '',
  currentStep: 0,
  isTracing: false,
  // Tracks the current in-flight trace request so it can be canceled.
  activeRunId: null,
  activeRunAbortController: null,
  traceError: null,
  compilationError: null,

  isPlaying: false,
  playSpeed: 700,

  beginnerMode: false,
  toggleBeginnerMode: () => set((s) => ({ beginnerMode: !s.beginnerMode })),

  setSteps: (steps, finalOutput = '') => {
    clearLineExplanationCache();
    set({
      steps, finalOutput, currentStep: 0, traceError: null, compilationError: null,
      lineExplanations: {},  // reset line explanations on new trace
    });
  },
  setCurrentStep: (step) => set({ currentStep: step }),
  setIsTracing: (isTracing) => set({ isTracing }),
  setActiveRun: (runId, abortController) => set({
    activeRunId: runId,
    activeRunAbortController: abortController,
  }),
  clearActiveRun: (runId) => set((s) => {
    if (runId && s.activeRunId !== runId) return {};
    return { activeRunId: null, activeRunAbortController: null };
  }),
  setTraceError: (error) => set({ traceError: error }),
  setCompilationError: (error) => set({ compilationError: error }),

  play: () => {
    const { steps, currentStep, isPlaying } = get();
    if (isPlaying || currentStep >= steps.length - 1) return;
    set({ isPlaying: true });
  },
  pause: () => set({ isPlaying: false }),
  stepForward: () => {
    const { steps, currentStep } = get();
    if (currentStep < steps.length - 1) set({ currentStep: currentStep + 1 });
  },
  stepBackward: () => {
    const { currentStep } = get();
    if (currentStep > 0) set({ currentStep: currentStep - 1 });
  },
  reset: () => set({
    currentStep: 0, isPlaying: false,
    activeRunId: null,
    activeRunAbortController: null,
    executionStatus: 'idle', collectedInputs: [], outputHistory: [], inputPromptVisible: false,
  }),
  setPlaySpeed: (speed) => set({ playSpeed: speed }),

  // ── Execution State Machine (Input Support) ────────────────────────
  // 'idle' | 'running' | 'paused_for_input' | 'completed' | 'error'
  executionStatus: 'idle',
  collectedInputs: [],      // accumulated user inputs across pauses
  outputHistory: [],         // terminal-like entries: {type: 'output'|'input'|'system', text}
  inputPromptVisible: false, // show inline input field in Output tab

  setExecutionStatus: (status) => set({ executionStatus: status }),

  // Add a user input and record it in terminal history
  addInput: (value) => set((s) => ({
    collectedInputs: [...s.collectedInputs, value],
    outputHistory: [...s.outputHistory, { type: 'input', text: value }],
    inputPromptVisible: false,
  })),

  // Append an entry to the output terminal history
  appendOutputHistory: (entry) => set((s) => ({
    outputHistory: [...s.outputHistory, entry],
  })),

  // Show the input prompt in the Output tab
  showInputPrompt: () => set({ inputPromptVisible: true }),

  // Clear all input-related state for a fresh execution
  clearInputState: () => set({
    executionStatus: 'idle',
    collectedInputs: [],
    outputHistory: [],
    inputPromptVisible: false,
  }),

  // ── AI State ──────────────────────────────────────────────────────
  traceSummary: null,
  setTraceSummary: (summary) => set({ traceSummary: summary }),

  // Complexity analysis (time + space)
  aiComplexity: null,
  setAiComplexity: (data) => set({ aiComplexity: data }),

  // Code explanation
  aiExplanation: null,
  aiExplanationLoading: false,
  setAiExplanation: (text) => set({ aiExplanation: text }),
  setAiExplanationLoading: (loading) => set({ aiExplanationLoading: loading }),

  // Chat messages
  aiChatMessages: [],
  addChatMessage: (msg) =>
    set((s) => ({ aiChatMessages: [...s.aiChatMessages, msg] })),
  clearChatMessages: () => set({ aiChatMessages: [] }),

  // Line-level AI explanations (step index → explanation string)
  lineExplanations: {},
  lineExplanationLoading: null,  // step index currently loading, or null
  setLineExplanation: (stepIndex, text) =>
    set((s) => ({
      lineExplanations: { ...s.lineExplanations, [stepIndex]: text },
      lineExplanationLoading: s.lineExplanationLoading === stepIndex ? null : s.lineExplanationLoading,
    })),
  setLineExplanationLoading: (stepIndex) => set({ lineExplanationLoading: stepIndex }),

  // Active bottom-right tab (timeline | complexity | chat)
  activeAiTab: 'timeline',
  setActiveAiTab: (tab) => set({ activeAiTab: tab }),

  // Active editor tab (source | output)
  activeEditorTab: 'source',
  setActiveEditorTab: (tab) => set({ activeEditorTab: tab }),

  // Editor instance ref (for mobile toolbar access)
  editorInstance: null,
  setEditorInstance: (editor) => set({ editorInstance: editor }),
}));

export default useTraceStore;
