/**
 * Tests for the Python parser adapter
 */

import { describe, it, expect } from 'vitest';
import { PythonParser } from '../../../src/parsers/python/python-parser.js';

describe('PythonParser', () => {
  const parser = new PythonParser();

  describe('function parsing', () => {
    it('should parse a simple function', () => {
      const ir = parser.parse(`
def foo(x, y):
    return x + y
`);
      expect(ir.type).toBe('program');
      expect(ir.language).toBe('python');
      expect(ir.functions).toHaveLength(1);

      const func = ir.functions[0];
      expect(func.name).toBe('foo');
      expect(func.params).toEqual(['x', 'y']);
    });

    it('should parse a function with no params', () => {
      const ir = parser.parse(`
def hello():
    print("hello")
`);
      expect(ir.functions).toHaveLength(1);
      expect(ir.functions[0].params).toEqual([]);
    });

    it('should parse nested functions', () => {
      const ir = parser.parse(`
def outer():
    def inner():
        pass
    inner()
`);
      expect(ir.functions).toHaveLength(1);
      expect(ir.functions[0].name).toBe('outer');

      // Inner function should be in the body
      const innerFuncs = ir.functions[0].findAll(n => n.type === 'function');
      expect(innerFuncs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('for loop parsing', () => {
    it('should parse range(n) loop as counted loop', () => {
      const ir = parser.parse(`
def foo(n):
    for i in range(n):
        print(i)
`);
      const loops = ir.findAll(n => n.type === 'loop');
      expect(loops).toHaveLength(1);

      const loop = loops[0];
      expect(loop.loopType).toBe('for');
      expect(loop.iteratorVar).toBe('i');
      expect(loop.boundVar).toBe('n');
      expect(loop.initValue).toBe(0);
      expect(loop.incrementType).toBe('additive');
      expect(loop.incrementValue).toBe(1);
    });

    it('should parse range(start, stop) loop', () => {
      const ir = parser.parse(`
def foo(n):
    for i in range(1, n):
        pass
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.initValue).toBe(1);
      expect(loop.boundVar).toBe('n');
    });

    it('should parse range(start, stop, step) loop', () => {
      const ir = parser.parse(`
def foo(n):
    for i in range(0, n, 2):
        pass
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.initValue).toBe(0);
      expect(loop.boundVar).toBe('n');
      expect(loop.incrementValue).toBe(2);
    });

    it('should parse for-each loop over non-range', () => {
      const ir = parser.parse(`
def foo(items):
    for item in items:
        process(item)
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('for-each');
      expect(loop.iteratorVar).toBe('item');
    });

    it('should parse nested loops', () => {
      const ir = parser.parse(`
def foo(n):
    for i in range(n):
        for j in range(n):
            pass
`);
      const loops = ir.findAll(n => n.type === 'loop');
      expect(loops).toHaveLength(2);
    });
  });

  describe('while loop parsing', () => {
    it('should parse a while loop', () => {
      const ir = parser.parse(`
def foo(n):
    while n > 0:
        n -= 1
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('while');
      expect(loop.condition).toContain('n > 0');
    });
  });

  describe('if statement parsing', () => {
    it('should parse if/else', () => {
      const ir = parser.parse(`
def foo(x):
    if x > 0:
        return 1
    else:
        return -1
`);
      const branch = ir.findFirst(n => n.type === 'branch');
      expect(branch).not.toBeNull();
      expect(branch.condition).toContain('x > 0');
      expect(branch.consequence).not.toBeNull();
      expect(branch.alternative).not.toBeNull();
    });
  });

  describe('call parsing', () => {
    it('should parse function calls', () => {
      const ir = parser.parse(`
def foo():
    bar(1, 2)
`);
      const call = ir.findFirst(n => n.type === 'call');
      expect(call).not.toBeNull();
      expect(call.functionName).toBe('bar');
    });

    it('should detect recursive calls', () => {
      const ir = parser.parse(`
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
`);
      const calls = ir.findAll(n => n.type === 'call');
      const recursiveCall = calls.find(c => c.functionName === 'factorial');
      expect(recursiveCall).toBeDefined();
    });
  });

  describe('allocation parsing', () => {
    it('should detect list literals', () => {
      const ir = parser.parse(`
def foo():
    x = [1, 2, 3]
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
      expect(alloc.dataStructure).toBe('list');
    });

    it('should detect dict literals', () => {
      const ir = parser.parse(`
def foo():
    x = {"a": 1}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
      expect(alloc.dataStructure).toBe('dict');
    });
  });

  describe('control flow parsing', () => {
    it('should parse return statements', () => {
      const ir = parser.parse(`
def foo():
    return 42
`);
      const ret = ir.findFirst(n => n.type === 'return');
      expect(ret).not.toBeNull();
      expect(ret.value).toBe('42');
    });

    it('should parse break and continue', () => {
      const ir = parser.parse(`
def foo(n):
    for i in range(n):
        if i == 5:
            break
        if i == 3:
            continue
`);
      const breaks = ir.findAll(n => n.type === 'break');
      const continues = ir.findAll(n => n.type === 'continue');
      expect(breaks).toHaveLength(1);
      expect(continues).toHaveLength(1);
    });
  });

  describe('complex programs', () => {
    it('should parse bubble sort', () => {
      const ir = parser.parse(`
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
`);
      expect(ir.functions).toHaveLength(1);
      expect(ir.functions[0].name).toBe('bubble_sort');

      const loops = ir.findAll(n => n.type === 'loop');
      expect(loops).toHaveLength(2);

      const branches = ir.findAll(n => n.type === 'branch');
      expect(branches).toHaveLength(1);
    });

    it('should parse binary search', () => {
      const ir = parser.parse(`
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
`);
      expect(ir.functions).toHaveLength(1);
      const loops = ir.findAll(n => n.type === 'loop');
      expect(loops).toHaveLength(1);
      expect(loops[0].loopType).toBe('while');
    });
  });
});
