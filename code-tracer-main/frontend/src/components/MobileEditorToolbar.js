import React, { useState, useEffect, useCallback, useRef } from 'react';
import useTraceStore from '@/store/traceStore';
import {
  SelectionAll,
  TextAa,
  Cursor,
  Scissors,
  Copy,
  ClipboardText,
  ArrowUUpLeft,
  ArrowUUpRight,
  TrashSimple,
  CopySimple,
  Selection,
  TextIndent,
  TextOutdent,
  ArrowLineDown,
} from '@phosphor-icons/react';

/**
 * MobileEditorToolbar
 * Floating toolbar for phones & tablets (< 1024px) that provides
 * quick-access editing actions missing from Monaco's mobile experience.
 */
const MobileEditorToolbar = () => {
  const editorInstance = useTraceStore((s) => s.editorInstance);
  const isTracing = useTraceStore((s) => s.isTracing);
  const [isMobile, setIsMobile] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastActionRef = useRef(0); // prevent double-fire from onTouchEnd + onClick

  // Guard to deduplicate touch + click events
  const dedup = useCallback((fn) => {
    return (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastActionRef.current < 300) return;
      lastActionRef.current = now;
      fn();
    };
  }, []);

  // Check screen size for phones + tablets (< 1024px)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Track whether the editor currently has a selection
  useEffect(() => {
    if (!editorInstance) return;
    const disposable = editorInstance.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      const empty = sel.startLineNumber === sel.endLineNumber &&
        sel.startColumn === sel.endColumn;
      setHasSelection(!empty);
    });
    return () => disposable.dispose();
  }, [editorInstance]);

  // Focus the editor after performing an action (keeps keyboard open)
  const focusEditor = useCallback(() => {
    if (editorInstance) editorInstance.focus();
  }, [editorInstance]);

  // ── Editor Actions ─────────────────────────────────────────
  const selectAll = useCallback(() => {
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;
    const lineCount = model.getLineCount();
    const lastLineLength = model.getLineMaxColumn(lineCount);
    const monaco = window.monaco;
    editorInstance.setSelection(
      new monaco.Selection(1, 1, lineCount, lastLineLength)
    );
    focusEditor();
  }, [editorInstance, focusEditor]);

  const selectLine = useCallback(() => {
    if (!editorInstance) return;
    const pos = editorInstance.getPosition();
    if (!pos) return;
    const model = editorInstance.getModel();
    if (!model) return;
    const lineLength = model.getLineMaxColumn(pos.lineNumber);
    const monaco = window.monaco;
    editorInstance.setSelection(
      new monaco.Selection(pos.lineNumber, 1, pos.lineNumber, lineLength)
    );
    focusEditor();
  }, [editorInstance, focusEditor]);

  const selectWord = useCallback(() => {
    if (!editorInstance) return;
    editorInstance.getAction('editor.action.addSelectionToNextFindMatch')?.run();
    focusEditor();
  }, [editorInstance, focusEditor]);

  const doCut = useCallback(async () => {
    if (!editorInstance) return;
    // Get selected text
    const sel = editorInstance.getSelection();
    const model = editorInstance.getModel();
    if (!sel || !model) return;
    const text = model.getValueInRange(sel);
    if (text) {
      try { await navigator.clipboard.writeText(text); } catch { /* fallback below */ }
      // Delete the selection
      editorInstance.executeEdits('mobile-toolbar', [{
        range: sel,
        text: '',
      }]);
    } else {
      // No selection: cut current line
      const pos = editorInstance.getPosition();
      if (!pos) return;
      const lineCount = model.getLineCount();
      const monaco = window.monaco;
      let range;
      if (pos.lineNumber < lineCount) {
        range = new monaco.Range(pos.lineNumber, 1, pos.lineNumber + 1, 1);
      } else {
        const prevLineEnd = pos.lineNumber > 1
          ? model.getLineMaxColumn(pos.lineNumber - 1)
          : 1;
        range = pos.lineNumber > 1
          ? new monaco.Range(pos.lineNumber - 1, prevLineEnd, pos.lineNumber, model.getLineMaxColumn(pos.lineNumber))
          : new monaco.Range(1, 1, 1, model.getLineMaxColumn(1));
      }
      const lineText = model.getValueInRange(range);
      try { await navigator.clipboard.writeText(lineText); } catch { /* ok */ }
      editorInstance.executeEdits('mobile-toolbar', [{ range, text: '' }]);
    }
    focusEditor();
  }, [editorInstance, focusEditor]);

  const doCopy = useCallback(async () => {
    if (!editorInstance) return;
    const sel = editorInstance.getSelection();
    const model = editorInstance.getModel();
    if (!sel || !model) return;
    let text = model.getValueInRange(sel);
    if (!text) {
      // No selection: copy current line
      const pos = editorInstance.getPosition();
      if (pos) {
        text = model.getLineContent(pos.lineNumber);
      }
    }
    if (text) {
      try { await navigator.clipboard.writeText(text); } catch { /* ok */ }
    }
    focusEditor();
  }, [editorInstance, focusEditor]);

  const doPaste = useCallback(async () => {
    if (!editorInstance) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        editorInstance.trigger('mobile-toolbar', 'type', { text });
      }
    } catch {
      // Clipboard API may fail — user can use OS paste
    }
    focusEditor();
  }, [editorInstance, focusEditor]);

  const doUndo = useCallback(() => {
    if (!editorInstance) return;
    editorInstance.trigger('mobile-toolbar', 'undo', {});
    focusEditor();
  }, [editorInstance, focusEditor]);

  const doRedo = useCallback(() => {
    if (!editorInstance) return;
    editorInstance.trigger('mobile-toolbar', 'redo', {});
    focusEditor();
  }, [editorInstance, focusEditor]);

  const deleteLine = useCallback(() => {
    if (!editorInstance) return;
    editorInstance.getAction('editor.action.deleteLines')?.run();
    focusEditor();
  }, [editorInstance, focusEditor]);

  const duplicateLine = useCallback(() => {
    if (!editorInstance) return;
    editorInstance.getAction('editor.action.copyLinesDownAction')?.run();
    focusEditor();
  }, [editorInstance, focusEditor]);

  const indentLine = useCallback(() => {
    if (!editorInstance) return;
    editorInstance.getAction('editor.action.indentLines')?.run();
    focusEditor();
  }, [editorInstance, focusEditor]);

  const outdentLine = useCallback(() => {
    if (!editorInstance) return;
    editorInstance.getAction('editor.action.outdentLines')?.run();
    focusEditor();
  }, [editorInstance, focusEditor]);

  const addLineBelow = useCallback(() => {
    if (!editorInstance) return;
    editorInstance.getAction('editor.action.insertLineAfter')?.run();
    focusEditor();
  }, [editorInstance, focusEditor]);

  // Don't render on desktop or during tracing
  if (!isMobile || isTracing) return null;

  const SELECTION_ACTIONS = [
    { icon: SelectionAll, label: 'All', action: selectAll, id: 'sel-all' },
    { icon: TextAa, label: 'Line', action: selectLine, id: 'sel-line' },
    { icon: Cursor, label: 'Word', action: selectWord, id: 'sel-word' },
  ];

  const EDIT_ACTIONS = [
    { icon: Scissors, label: 'Cut', action: doCut, id: 'act-cut', highlight: hasSelection },
    { icon: Copy, label: 'Copy', action: doCopy, id: 'act-copy' },
    { icon: ClipboardText, label: 'Paste', action: doPaste, id: 'act-paste' },
    { icon: ArrowUUpLeft, label: 'Undo', action: doUndo, id: 'act-undo' },
    { icon: ArrowUUpRight, label: 'Redo', action: doRedo, id: 'act-redo' },
  ];

  const LINE_ACTIONS = [
    { icon: TrashSimple, label: 'Del Line', action: deleteLine, id: 'line-del', danger: true },
    { icon: CopySimple, label: 'Dup Line', action: duplicateLine, id: 'line-dup' },
    { icon: TextIndent, label: 'Indent', action: indentLine, id: 'line-indent' },
    { icon: TextOutdent, label: 'Outdent', action: outdentLine, id: 'line-outdent' },
    { icon: ArrowLineDown, label: 'New Line', action: addLineBelow, id: 'line-new' },
  ];

  return (
    <div className={`mobile-editor-toolbar ${isVisible ? '' : 'collapsed'}`} data-testid="mobile-editor-toolbar">
      {/* Toggle visibility handle */}
      <button
        className="mobile-toolbar-toggle"
        onClick={() => setIsVisible(!isVisible)}
        data-testid="mobile-toolbar-toggle"
        aria-label={isVisible ? 'Hide toolbar' : 'Show toolbar'}
      >
        <Selection size={12} weight="bold" />
        <span>{isVisible ? 'Hide Tools' : 'Edit Tools'}</span>
        <span className="toggle-chevron">{isVisible ? '▾' : '▴'}</span>
      </button>

      {isVisible && (
        <div className="mobile-toolbar-rows">
          {/* Row 1: Selection */}
          <div className="mobile-toolbar-row">
            <span className="mobile-toolbar-group-label">SELECT</span>
            {SELECTION_ACTIONS.map(({ icon: Icon, label, action, id }) => (
              <button
                key={id}
                data-testid={`mobile-${id}`}
                className="mobile-toolbar-btn"
                onClick={dedup(action)}
                onTouchEnd={dedup(action)}
              >
                <Icon size={16} weight="regular" />
                <span>{label}</span>
              </button>
            ))}

            <span className="mobile-toolbar-divider" />
            <span className="mobile-toolbar-group-label">EDIT</span>
            {EDIT_ACTIONS.map(({ icon: Icon, label, action, id, highlight }) => (
              <button
                key={id}
                data-testid={`mobile-${id}`}
                className={`mobile-toolbar-btn ${highlight ? 'btn-highlight' : ''}`}
                onClick={dedup(action)}
                onTouchEnd={dedup(action)}
              >
                <Icon size={16} weight="regular" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Row 2: Line operations */}
          <div className="mobile-toolbar-row">
            <span className="mobile-toolbar-group-label">LINE</span>
            {LINE_ACTIONS.map(({ icon: Icon, label, action, id, danger }) => (
              <button
                key={id}
                data-testid={`mobile-${id}`}
                className={`mobile-toolbar-btn ${danger ? 'btn-danger' : ''}`}
                onClick={dedup(action)}
                onTouchEnd={dedup(action)}
              >
                <Icon size={16} weight="regular" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileEditorToolbar;
