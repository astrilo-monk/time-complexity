/**
 * Tests for the C++ parser adapter
 */

import { describe, it, expect } from 'vitest';
import { CppParser } from '../../../src/parsers/cpp/cpp-parser.js';

describe('CppParser', () => {
  const parser = new CppParser();

  describe('function parsing', () => {
    it('should parse a simple function', () => {
      const ir = parser.parse(`
int add(int a, int b) {
    return a + b;
}
`);
      expect(ir.functions).toHaveLength(1);
      expect(ir.functions[0].name).toBe('add');
      expect(ir.functions[0].params).toEqual(['a', 'b']);
    });
  });

  describe('for loop parsing', () => {
    it('should parse standard for loop', () => {
      const ir = parser.parse(`
void foo(int n) {
    for (int i = 0; i < n; i++) {
        cout << i;
    }
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('for');
      expect(loop.iteratorVar).toBe('i');
      expect(loop.boundVar).toBe('n');
      expect(loop.incrementType).toBe('additive');
    });

    it('should parse range-based for loop', () => {
      const ir = parser.parse(`
void foo(vector<int>& v) {
    for (auto x : v) {
        cout << x;
    }
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('for-each');
    });
  });

  describe('while and do-while', () => {
    it('should parse while loop', () => {
      const ir = parser.parse(`
void foo(int n) {
    while (n > 0) {
        n--;
    }
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('while');
    });

    it('should parse do-while loop', () => {
      const ir = parser.parse(`
void foo(int n) {
    do {
        n--;
    } while (n > 0);
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('do-while');
    });
  });

  describe('allocation parsing', () => {
    it('should detect vector declarations', () => {
      const ir = parser.parse(`
void foo() {
    vector<int> v;
}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
      expect(alloc.dataStructure).toBe('vector');
    });

    it('should detect map declarations', () => {
      const ir = parser.parse(`
void foo() {
    unordered_map<string, int> m;
}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
      expect(alloc.dataStructure).toBe('unordered_map');
    });

    it('should detect new expressions', () => {
      const ir = parser.parse(`
void foo(int n) {
    int* arr = new int[n];
}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
    });
  });

  describe('complex programs', () => {
    it('should parse nested loops', () => {
      const ir = parser.parse(`
void matrix_mult(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            for (int k = 0; k < n; k++) {
                printf("%d", i + j + k);
            }
        }
    }
}
`);
      const loops = ir.findAll(n => n.type === 'loop');
      expect(loops).toHaveLength(3);
    });
  });
});
