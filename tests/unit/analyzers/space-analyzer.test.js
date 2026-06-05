/**
 * Tests for the Space Analyzer
 *
 * End-to-end: source code -> parser -> IR -> analysis -> space complexity result.
 */

import { describe, it, expect } from 'vitest';
import { analyze } from '../../../src/index.js';

describe('SpaceAnalyzer', () => {

  // -- O(1) - constant space -----------------------------------

  describe('O(1) - constant space', () => {
    it('no allocations, no recursion -> O(1)', () => {
      const result = analyze(`
int add(int a, int b) {
    return a + b;
}
`, { language: 'c' });
      expect(result.functions[0].spaceDisplay).toBe('O(1)');
    });

    it('only scalar variables -> O(1)', () => {
      const result = analyze(`
def compute(n):
    x = n * 2
    y = x + 1
    return y
`, { language: 'python' });
      expect(result.functions[0].spaceDisplay).toBe('O(1)');
    });
  });

  // -- O(n) - linear space (allocation) -----------------------

  describe('O(n) - linear space from allocations', () => {
    it('C: malloc(n) -> O(n)', () => {
      const result = analyze(`
void allocate(int n) {
    int* arr = malloc(n * sizeof(int));
    for (int i = 0; i < n; i++) {
        arr[i] = i;
    }
}
`, { language: 'c' });
      expect(result.functions[0].spaceDisplay).toBe('O(n)');
    });

    it('Java: new int[n] -> O(n)', () => {
      const result = analyze(`
public class Main {
    void create(int n) {
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) {
            arr[i] = i;
        }
    }
}
`, { language: 'java' });
      expect(result.functions[0].spaceDisplay).toBe('O(n)');
    });

    it('C++: new int[n] -> O(n)', () => {
      const result = analyze(`
void create(int n) {
    int* arr = new int[n];
    for (int i = 0; i < n; i++) {
        arr[i] = i;
    }
}
`, { language: 'cpp' });
      expect(result.functions[0].spaceDisplay).toBe('O(n)');
    });
  });

  // -- O(n) - linear space (recursion stack) ------------------

  describe('O(n) - linear space from recursion stack', () => {
    it('linear recursion f(n-1) -> O(n) stack', () => {
      const result = analyze(`
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`, { language: 'c' });
      expect(result.functions[0].spaceDisplay).toBe('O(n)');
    });

    it('binary recursion f(n-1)+f(n-2) -> O(n) stack', () => {
      const result = analyze(`
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
`, { language: 'python' });
      expect(result.functions[0].spaceDisplay).toBe('O(n)');
    });
  });

  // -- O(log n) - log space from recursion stack --------------

  describe('O(log n) - log space from halving recursion', () => {
    it('binary search f(n/2) -> O(log n) stack', () => {
      const result = analyze(`
int bsearch(int arr[], int n, int target) {
    if (n <= 0) return -1;
    if (arr[n/2] == target) return n/2;
    return bsearch(arr, n / 2, target);
}
`, { language: 'c' });
      expect(result.functions[0].spaceDisplay).toBe('O(log n)');
    });
  });

  // -- Space reasoning output ---------------------------------

  describe('reasoning', () => {
    it('should produce space-specific reasoning', () => {
      const result = analyze(`
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`, { language: 'c' });
      const func = result.functions[0];
      expect(func.spaceReasoning.length).toBeGreaterThan(0);
      const hasStackReason = func.spaceReasoning.some(r =>
        r.toLowerCase().includes('stack')
      );
      expect(hasStackReason).toBe(true);
    });

    it('should have space confidence score', () => {
      const result = analyze(`
void allocate(int n) {
    int* arr = malloc(n * sizeof(int));
}
`, { language: 'c' });
      expect(result.functions[0].spaceConfidence).toBeDefined();
      expect(result.functions[0].spaceConfidence.score).toBeGreaterThan(0);
    });
  });

  // -- Overall report -----------------------------------------

  describe('overall report', () => {
    it('should include overall space complexity', () => {
      const result = analyze(`
def foo(n):
    for i in range(n):
        pass
`, { language: 'python' });
      expect(result.overall.spaceDisplay).toBeDefined();
      expect(result.overall.spaceDisplay).toBe('O(1)');
    });

    it('overall space should be max across functions', () => {
      const result = analyze(`
int simple(int x) {
    return x + 1;
}

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`, { language: 'c' });
      // simple = O(1) space, factorial = O(n) stack -> overall O(n)
      expect(result.overall.spaceDisplay).toBe('O(n)');
    });
  });

  // -- Time + space together ----------------------------------

  describe('time and space together', () => {
    it('O(n) time, O(1) space - simple loop', () => {
      const result = analyze(`
int sum(int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += i;
    }
    return total;
}
`, { language: 'c' });
      expect(result.functions[0].display).toBe('O(n)');
      expect(result.functions[0].spaceDisplay).toBe('O(1)');
    });

    it('O(2^n) time, O(n) space - fibonacci', () => {
      const result = analyze(`
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
`, { language: 'python' });
      expect(result.functions[0].display).toBe('O(2\u207f)');
      expect(result.functions[0].spaceDisplay).toBe('O(n)');
    });
  });
});
