/**
 * lineExplainer.js — Fetch AI-powered line explanations with caching.
 *
 * Each step's explanation is cached by a composite key so we don't
 * re-fetch if the user scrubs back and forth in the timeline.
 */

const API = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

// In-memory cache: key → Promise<string>
const _cache = new Map();

function _cacheKey(stepIndex, lineNumber, funcName) {
  return `${stepIndex}:${lineNumber}:${funcName}`;
}

/**
 * Fetch an AI explanation for what happens at a specific line.
 * Results are cached so repeated calls for the same step return instantly.
 *
 * @param {object} params
 * @param {string} params.code        – full source code
 * @param {string} params.language    – "c" or "java"
 * @param {number} params.stepIndex   – index in the steps array (for cache key)
 * @param {number} params.lineNumber  – 1-based line number
 * @param {string} params.lineText    – trimmed text of the line
 * @param {string} params.funcName    – current function name
 * @param {Array}  params.variables   – current variable list
 * @param {number} params.stackDepth  – stack depth
 * @param {number|null} params.prevLine – previous step's line number
 * @param {string|null} params.prevFunc – previous step's function name
 * @returns {Promise<string|null>} the explanation text, or null on failure
 */
export async function fetchLineExplanation({
  code,
  language,
  stepIndex,
  lineNumber,
  lineText,
  funcName,
  variables,
  stackDepth,
  prevLine,
  prevFunc,
}) {
  const key = _cacheKey(stepIndex, lineNumber, funcName);

  if (_cache.has(key)) {
    return _cache.get(key);
  }

  const safeCode = code.length > 50000 ? code.slice(0, 50000) : code;
  const safeLineText = lineText.length > 500 ? lineText.slice(0, 500) : lineText;
  const safeFuncName = funcName.length > 200 ? funcName.slice(0, 200) : funcName;

  const promise = (async () => {
    try {
      const resp = await fetch(`${API}/ai/explain-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: safeCode,
          language,
          line_number: lineNumber,
          line_text: safeLineText,
          func_name: safeFuncName,
          variables: variables.slice(0, 10),
          stack_depth: stackDepth,
          prev_line: prevLine,
          prev_func: prevFunc,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        _cache.delete(key);
        return errorData.explanation || null;
      }

      const data = await resp.json();
      return data.explanation || 'No explanation available.';
    } catch (err) {
      console.warn('lineExplainer fetch error:', err);
      _cache.delete(key);
      return null;
    }
  })();

  _cache.set(key, promise);
  return promise;
}

/**
 * Clear the explanation cache (e.g. when new code is traced).
 */
export function clearLineExplanationCache() {
  _cache.clear();
}
