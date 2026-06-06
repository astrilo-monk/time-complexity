/**
 * Tests for the Pattern Detector
 *
 * End-to-end: source code -> parser -> IR -> analysis -> pattern detection.
 * Uses a custom engine setup since PatternDetector is not yet in the
 * default analyze() pipeline.
 */

import { describe, it, expect } from 'vitest';
import { ComplexityEngine } from '../../../src/core/complexity-engine.js';
import { LoopAnalyzer } from '../../../src/analyzers/loop-analyzer.js';
import { RecursionAnalyzer } from '../../../src/analyzers/recursion-analyzer.js';
import { SpaceAnalyzer } from '../../../src/analyzers/space-analyzer.js';
import { PatternDetector } from '../../../src/analyzers/pattern-detector.js';

/**
 * Helper: run full pipeline with pattern detection enabled.
 */
function analyzeWithPatterns(code, language) {
  const engine = new ComplexityEngine();
  engine.use(new LoopAnalyzer());
  engine.use(new RecursionAnalyzer());
  engine.use(new SpaceAnalyzer());
  engine.use(new PatternDetector());
  return engine.analyze(code, { language });
}

/**
 * Helper: extract detected patterns for a function by name.
 */
function getPatterns(result, funcName) {
  const patternResult = result.analyzerResults.find(
    r => r.analyzerName === 'pattern-detector'
  );
  if (!patternResult) return [];
  const funcResult = patternResult.functionResults.find(
    r => r.functionName === funcName
  );
  return funcResult ? funcResult.patterns : [];
}

describe('PatternDetector', () => {

  // ---- Binary Search ----

  describe('binary-search', () => {
    it('C: recursive binary search with n/2', () => {
      const result = analyzeWithPatterns(`
int bsearch(int arr[], int n, int target) {
    if (n <= 0) return -1;
    if (arr[n/2] == target) return n/2;
    return bsearch(arr, n / 2, target);
}
`, 'c');
      const patterns = getPatterns(result, 'bsearch');
      expect(patterns.some(p => p.pattern === 'binary-search')).toBe(true);
    });

    it('C: iterative binary search with mid variable', () => {
      const result = analyzeWithPatterns(`
int bsearch(int arr[], int n, int target) {
    int lo = 0;
    int hi = n;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return -1;
}
`, 'c');
      const patterns = getPatterns(result, 'bsearch');
      expect(patterns.some(p => p.pattern === 'binary-search')).toBe(true);
    });
  });

  // ---- Merge Sort ----

  describe('merge-sort', () => {
    it('C: merge sort with 2x f(n/2) and merge loop', () => {
      const result = analyzeWithPatterns(`
void merge_sort(int arr[], int n) {
    if (n <= 1) return;
    merge_sort(arr, n / 2);
    merge_sort(arr + n/2, n / 2);
    for (int i = 0; i < n; i++) {
        arr[i] = arr[i];
    }
}
`, 'c');
      const patterns = getPatterns(result, 'merge_sort');
      expect(patterns.some(p => p.pattern === 'merge-sort')).toBe(true);
      // Should also be detected as divide-and-conquer
      expect(patterns.some(p => p.pattern === 'divide-and-conquer')).toBe(true);
    });
  });

  // ---- Divide and Conquer ----

  describe('divide-and-conquer', () => {
    it('C: generic divide and conquer with 2 halving calls', () => {
      const result = analyzeWithPatterns(`
int solve(int arr[], int n) {
    if (n <= 1) return arr[0];
    int a = solve(arr, n / 2);
    int b = solve(arr + n/2, n / 2);
    return a + b;
}
`, 'c');
      const patterns = getPatterns(result, 'solve');
      expect(patterns.some(p => p.pattern === 'divide-and-conquer')).toBe(true);
    });
  });

  // ---- Bubble Sort ----

  describe('bubble-sort', () => {
    it('C: classic bubble sort with temp swap', () => {
      const result = analyzeWithPatterns(`
void bubble_sort(int arr[], int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - 1; j++) {
            if (arr[j] > arr[j+1]) {
                int temp = arr[j];
                arr[j] = arr[j+1];
                arr[j+1] = temp;
            }
        }
    }
}
`, 'c');
      const patterns = getPatterns(result, 'bubble_sort');
      expect(patterns.some(p => p.pattern === 'bubble-sort')).toBe(true);
    });

    it('Python: bubble sort with swap', () => {
      const result = analyzeWithPatterns(`
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1):
            if arr[j] > arr[j + 1]:
                temp = arr[j]
                arr[j] = arr[j + 1]
                arr[j + 1] = temp
`, 'python');
      const patterns = getPatterns(result, 'bubble_sort');
      expect(patterns.some(p => p.pattern === 'bubble-sort')).toBe(true);
    });
  });

  // ---- Backtracking ----

  describe('backtracking', () => {
    it('C: subset generation with 2 sequential recursive calls', () => {
      const result = analyzeWithPatterns(`
void subsets(int arr[], int n, int index, int current[], int size) {
    if (index >= n) {
        return;
    }
    subsets(arr, n, index + 1, current, size);
    current[size] = arr[index];
    subsets(arr, n, index + 1, current, size + 1);
}
`, 'c');
      const patterns = getPatterns(result, 'subsets');
      expect(patterns.some(p => p.pattern === 'backtracking')).toBe(true);
    });

    it('C: tower of hanoi detected as backtracking', () => {
      const result = analyzeWithPatterns(`
void hanoi(int n, char from, char to, char aux) {
    if (n <= 0) return;
    hanoi(n - 1, from, aux, to);
    printf("move %d", n);
    hanoi(n - 1, aux, to, from);
}
`, 'c');
      const patterns = getPatterns(result, 'hanoi');
      expect(patterns.some(p => p.pattern === 'backtracking')).toBe(true);
    });
  });

  // ---- Two Pointer ----

  describe('two-pointer', () => {
    it('C: while loop with left and right pointers', () => {
      const result = analyzeWithPatterns(`
int two_sum(int arr[], int n, int target) {
    int left = 0;
    int right = n - 1;
    while (left < right) {
        int sum = arr[left] + arr[right];
        if (sum == target) return 1;
        if (sum < target) left = left + 1;
        else right = right - 1;
    }
    return 0;
}
`, 'c');
      const patterns = getPatterns(result, 'two_sum');
      expect(patterns.some(p => p.pattern === 'two-pointer')).toBe(true);
    });

    it('C: while loop with lo and hi', () => {
      const result = analyzeWithPatterns(`
void search(int arr[], int n) {
    int lo = 0;
    int hi = n;
    while (lo < hi) {
        if (arr[lo] == arr[hi]) return;
        lo = lo + 1;
        hi = hi - 1;
    }
}
`, 'c');
      const patterns = getPatterns(result, 'search');
      expect(patterns.some(p => p.pattern === 'two-pointer')).toBe(true);
    });
  });

  // ---- Matrix Traversal ----

  describe('matrix-traversal', () => {
    it('C: triple nested loop (matrix multiply)', () => {
      const result = analyzeWithPatterns(`
void matmul(int a[], int b[], int c[], int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            for (int k = 0; k < n; k++) {
                c[i] = c[i] + a[j] * b[k];
            }
        }
    }
}
`, 'c');
      const patterns = getPatterns(result, 'matmul');
      expect(patterns.some(p => p.pattern === 'matrix-traversal')).toBe(true);
    });
  });

  // ---- Accumulation ----

  describe('accumulation', () => {
    it('C: sum accumulation in a loop', () => {
      const result = analyzeWithPatterns(`
int total(int arr[], int n) {
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum = sum + arr[i];
    }
    return sum;
}
`, 'c');
      const patterns = getPatterns(result, 'total');
      expect(patterns.some(p => p.pattern === 'accumulation')).toBe(true);
    });

    it('Python: count accumulation', () => {
      const result = analyzeWithPatterns(`
def counter(arr):
    count = 0
    for x in arr:
        count = count + 1
    return count
`, 'python');
      const patterns = getPatterns(result, 'counter');
      expect(patterns.some(p => p.pattern === 'accumulation')).toBe(true);
    });
  });

  // ---- Linear Search ----

  describe('linear-search', () => {
    it('C: loop with early return on match', () => {
      const result = analyzeWithPatterns(`
int find(int arr[], int n, int target) {
    for (int i = 0; i < n; i++) {
        if (arr[i] == target) {
            return i;
        }
    }
    return -1;
}
`, 'c');
      const patterns = getPatterns(result, 'find');
      expect(patterns.some(p => p.pattern === 'linear-search')).toBe(true);
    });

    it('Java: loop with break on match', () => {
      const result = analyzeWithPatterns(`
public class Main {
    int search(int[] arr, int target) {
        int result = -1;
        for (int i = 0; i < arr.length; i++) {
            if (arr[i] == target) {
                result = i;
                break;
            }
        }
        return result;
    }
}
`, 'java');
      const patterns = getPatterns(result, 'search');
      expect(patterns.some(p => p.pattern === 'linear-search')).toBe(true);
    });
  });

  // ---- No patterns ----

  describe('no patterns', () => {
    it('should report no patterns for trivial function', () => {
      const result = analyzeWithPatterns(`
int add(int a, int b) {
    return a + b;
}
`, 'c');
      const patterns = getPatterns(result, 'add');
      expect(patterns.length).toBe(0);
    });
  });

  // ---- Multiple patterns ----

  describe('multiple patterns', () => {
    it('merge sort should match both merge-sort and divide-and-conquer', () => {
      const result = analyzeWithPatterns(`
void msort(int arr[], int n) {
    if (n <= 1) return;
    msort(arr, n / 2);
    msort(arr + n/2, n / 2);
    for (int i = 0; i < n; i++) {
        arr[i] = arr[i];
    }
}
`, 'c');
      const patterns = getPatterns(result, 'msort');
      const patternNames = patterns.map(p => p.pattern);
      expect(patternNames).toContain('merge-sort');
      expect(patternNames).toContain('divide-and-conquer');
    });
  });
});
