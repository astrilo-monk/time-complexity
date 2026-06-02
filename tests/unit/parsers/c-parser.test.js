/**
 * Tests for the C parser adapter
 */

import { describe, it, expect } from 'vitest';
import { CParser } from '../../../src/parsers/c/c-parser.js';

describe('CParser', () => {
  const parser = new CParser();

  describe('function parsing', () => {
    it('should parse a simple function', () => {
      const ir = parser.parse(`
int add(int a, int b) {
    return a + b;
}
`);
      expect(ir.functions).toHaveLength(1);
      const func = ir.functions[0];
      expect(func.name).toBe('add');
      expect(func.params).toEqual(['a', 'b']);
      expect(func.returnType).toBe('int');
    });

    it('should parse void function', () => {
      const ir = parser.parse(`
void hello() {
    printf("hello");
}
`);
      expect(ir.functions).toHaveLength(1);
      expect(ir.functions[0].returnType).toBe('void');
    });

    it('should parse multiple functions', () => {
      const ir = parser.parse(`
int foo() { return 1; }
int bar() { return 2; }
`);
      expect(ir.functions).toHaveLength(2);
    });
  });

  describe('for loop parsing', () => {
    it('should parse standard for loop with i++', () => {
      const ir = parser.parse(`
void foo(int n) {
    for (int i = 0; i < n; i++) {
        printf("%d", i);
    }
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('for');
      expect(loop.iteratorVar).toBe('i');
      expect(loop.boundVar).toBe('n');
      expect(loop.initValue).toBe(0);
      expect(loop.incrementType).toBe('additive');
      expect(loop.incrementValue).toBe(1);
    });

    it('should parse multiplicative increment loop', () => {
      const ir = parser.parse(`
void foo(int n) {
    for (int i = 1; i < n; i *= 2) {
        printf("%d", i);
    }
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.incrementType).toBe('multiplicative');
      expect(loop.incrementValue).toBe(2);
    });

    it('should parse nested for loops', () => {
      const ir = parser.parse(`
void foo(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            printf("%d %d", i, j);
        }
    }
}
`);
      const loops = ir.findAll(n => n.type === 'loop');
      expect(loops).toHaveLength(2);
    });

    it('should parse for loop without braces', () => {
      const ir = parser.parse(`
void foo(int n) {
    for (int i = 0; i < n; i++)
        printf("%d", i);
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop).not.toBeNull();
      expect(loop.body).not.toBeNull();
    });
  });

  describe('while loop parsing', () => {
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
      expect(loop.condition).toContain('n > 0');
    });
  });

  describe('do-while loop parsing', () => {
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

  describe('if statement parsing', () => {
    it('should parse if/else', () => {
      const ir = parser.parse(`
int foo(int x) {
    if (x > 0) {
        return 1;
    } else {
        return -1;
    }
}
`);
      const branch = ir.findFirst(n => n.type === 'branch');
      expect(branch).not.toBeNull();
      expect(branch.consequence).not.toBeNull();
      expect(branch.alternative).not.toBeNull();
    });
  });

  describe('call parsing', () => {
    it('should parse function calls', () => {
      const ir = parser.parse(`
void foo() {
    bar(1, 2);
}
`);
      const call = ir.findFirst(n => n.type === 'call');
      expect(call).not.toBeNull();
      expect(call.functionName).toBe('bar');
      expect(call.arguments).toEqual(['1', '2']);
    });
  });

  describe('allocation parsing', () => {
    it('should detect malloc calls', () => {
      const ir = parser.parse(`
void foo(int n) {
    int *arr = malloc(n * sizeof(int));
}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
      expect(alloc.allocationType).toBe('dynamic');
    });

    it('should detect array declarations', () => {
      const ir = parser.parse(`
void foo() {
    int arr[100];
}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
      expect(alloc.dataStructure).toBe('array');
    });
  });

  describe('control flow', () => {
    it('should parse break and continue', () => {
      const ir = parser.parse(`
void foo(int n) {
    for (int i = 0; i < n; i++) {
        if (i == 5) break;
        if (i == 3) continue;
    }
}
`);
      expect(ir.findAll(n => n.type === 'break')).toHaveLength(1);
      expect(ir.findAll(n => n.type === 'continue')).toHaveLength(1);
    });
  });

  describe('complex programs', () => {
    it('should parse recursive factorial', () => {
      const ir = parser.parse(`
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`);
      expect(ir.functions).toHaveLength(1);
      expect(ir.functions[0].name).toBe('factorial');

      const calls = ir.findAll(n => n.type === 'call');
      const recursiveCall = calls.find(c => c.functionName === 'factorial');
      expect(recursiveCall).toBeDefined();
    });
  });
});
