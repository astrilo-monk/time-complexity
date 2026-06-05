/**
 * Tests for the Recursion Analyzer
 *
 * End-to-end: source code → parser → IR → analysis → complexity result.
 */

import { describe, it, expect } from 'vitest';
import { analyze } from '../../../src/index.js';

describe('RecursionAnalyzer', () => {

  // ─── O(n) — Linear recursion ──────────────────────────────

  describe('O(n) — linear recursion', () => {
    it('C: factorial(n-1) with O(1) work → O(n)', () => {
      const result = analyze(`
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`, { language: 'c' });
      const func = result.functions[0];
      expect(func.display).toBe('O(n)');
      expect(func.isRecursive).toBe(true);
    });

    it('Python: countdown(n-1) → O(n)', () => {
      const result = analyze(`
def countdown(n):
    if n <= 0:
        return
    print(n)
    countdown(n - 1)
`, { language: 'python' });
      const func = result.functions[0];
      expect(func.display).toBe('O(n)');
    });

    it('Java: sum(n-1) → O(n)', () => {
      const result = analyze(`
public class Main {
    int sum(int n) {
        if (n <= 0) return 0;
        return n + sum(n - 1);
    }
}
`, { language: 'java' });
      const func = result.functions[0];
      expect(func.display).toBe('O(n)');
    });
  });

  // ─── O(2ⁿ) — Binary recursion (Fibonacci) ────────────────

  describe('O(2ⁿ) — binary recursion', () => {
    it('C: fib(n-1) + fib(n-2) → O(2ⁿ)', () => {
      const result = analyze(`
int fib(int n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}
`, { language: 'c' });
      const func = result.functions[0];
      expect(func.display).toBe('O(2ⁿ)');
    });

    it('Python: fibonacci → O(2ⁿ)', () => {
      const result = analyze(`
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
`, { language: 'python' });
      const func = result.functions[0];
      expect(func.display).toBe('O(2ⁿ)');
    });
  });

  // ─── O(log n) — Halving recursion ─────────────────────────

  describe('O(log n) — halving recursion', () => {
    it('C: binary_search(n/2) → O(log n)', () => {
      const result = analyze(`
int bsearch(int arr[], int n, int target) {
    if (n <= 0) return -1;
    if (arr[n/2] == target) return n/2;
    return bsearch(arr, n / 2, target);
}
`, { language: 'c' });
      const func = result.functions[0];
      expect(func.display).toBe('O(log n)');
    });

    it('Python: power(n//2) → O(log n)', () => {
      const result = analyze(`
def power(base, n):
    if n == 0:
        return 1
    return base * power(base, n // 2)
`, { language: 'python' });
      const func = result.functions[0];
      expect(func.display).toBe('O(log n)');
    });
  });

  // ─── O(n log n) — Merge sort style ────────────────────────

  describe('O(n log n) — divide and conquer with O(n) merge', () => {
    it('C: merge_sort: 2 calls to f(n/2) with O(n) work → O(n log n)', () => {
      const result = analyze(`
void merge_sort(int arr[], int n) {
    if (n <= 1) return;
    merge_sort(arr, n / 2);
    merge_sort(arr + n/2, n / 2);
    for (int i = 0; i < n; i++) {
        arr[i] = arr[i];
    }
}
`, { language: 'c' });
      const func = result.functions[0];
      expect(func.display).toBe('O(n log n)');
    });
  });

  // ─── Tail recursion ───────────────────────────────────────

  describe('tail recursion', () => {
    it('C: tail-recursive sum → O(n)', () => {
      const result = analyze(`
int sum(int n, int acc) {
    if (n <= 0) return acc;
    return sum(n - 1, acc + n);
}
`, { language: 'c' });
      const func = result.functions[0];
      expect(func.display).toBe('O(n)');
    });
  });

  // ─── Reasoning output ─────────────────────────────────────

  describe('reasoning', () => {
    it('should produce recursion-specific reasoning', () => {
      const result = analyze(`
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`, { language: 'c' });
      const func = result.functions[0];
      expect(func.reasoning.length).toBeGreaterThan(0);

      const hasRecursionReason = func.reasoning.some(r =>
        r.toLowerCase().includes('recursive') || r.toLowerCase().includes('recursion')
      );
      expect(hasRecursionReason).toBe(true);
    });

    it('should detect base case', () => {
      const result = analyze(`
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`, { language: 'c' });
      const func = result.functions[0];
      const hasBaseCase = func.reasoning.some(r =>
        r.toLowerCase().includes('base case')
      );
      expect(hasBaseCase).toBe(true);
    });

    it('should include confidence score', () => {
      const result = analyze(`
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
`, { language: 'python' });
      const func = result.functions[0];
      expect(func.confidence.score).toBeGreaterThan(0);
    });
  });

  // ─── Non-recursive functions should be unaffected ─────────

  describe('non-recursive functions', () => {
    it('should not affect non-recursive functions', () => {
      const result = analyze(`
int add(int a, int b) {
    return a + b;
}
`, { language: 'c' });
      expect(result.functions[0].display).toBe('O(1)');
      expect(result.functions[0].isRecursive).toBe(false);
    });
  });

  // ─── Mixed: recursion + loops ─────────────────────────────

  describe('recursion with loops', () => {
    it('linear recursion with O(n) loop → O(n²)', () => {
      const result = analyze(`
void process(int n) {
    if (n <= 0) return;
    for (int i = 0; i < n; i++) {
        printf("%d", i);
    }
    process(n - 1);
}
`, { language: 'c' });
      const func = result.functions[0];
      expect(func.display).toBe('O(n²)');
    });
  });

  // ─── Report metadata ─────────────────────────────────────

  describe('report metadata', () => {
    it('should flag hasRecursion in metadata', () => {
      const result = analyze(`
int fact(int n) {
    if (n <= 1) return 1;
    return n * fact(n - 1);
}
`, { language: 'c' });
      expect(result.metadata.hasRecursion).toBe(true);
    });
  });
});
