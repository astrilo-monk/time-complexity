/**
 * Tests for the Java parser adapter
 */

import { describe, it, expect } from 'vitest';
import { JavaParser } from '../../../src/parsers/java/java-parser.js';

describe('JavaParser', () => {
  const parser = new JavaParser();

  describe('method parsing', () => {
    it('should parse a method inside a class', () => {
      const ir = parser.parse(`
public class Main {
    public static int add(int a, int b) {
        return a + b;
    }
}
`);
      expect(ir.functions).toHaveLength(1);
      const func = ir.functions[0];
      expect(func.name).toBe('add');
      expect(func.params).toEqual(['a', 'b']);
    });

    it('should parse multiple methods', () => {
      const ir = parser.parse(`
public class Main {
    void foo() {}
    void bar() {}
}
`);
      expect(ir.functions).toHaveLength(2);
    });

    it('should parse constructor', () => {
      const ir = parser.parse(`
public class MyClass {
    public MyClass(int x) {
        this.x = x;
    }
}
`);
      expect(ir.functions).toHaveLength(1);
      expect(ir.functions[0].name).toBe('MyClass');
    });
  });

  describe('for loop parsing', () => {
    it('should parse standard for loop', () => {
      const ir = parser.parse(`
public class Main {
    void foo(int n) {
        for (int i = 0; i < n; i++) {
            System.out.println(i);
        }
    }
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('for');
      expect(loop.iteratorVar).toBe('i');
      expect(loop.boundVar).toBe('n');
      expect(loop.incrementType).toBe('additive');
    });

    it('should parse enhanced for loop', () => {
      const ir = parser.parse(`
public class Main {
    void foo(int[] arr) {
        for (int x : arr) {
            System.out.println(x);
        }
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
public class Main {
    void foo(int n) {
        while (n > 0) {
            n--;
        }
    }
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('while');
    });

    it('should parse do-while loop', () => {
      const ir = parser.parse(`
public class Main {
    void foo(int n) {
        do {
            n--;
        } while (n > 0);
    }
}
`);
      const loop = ir.findFirst(n => n.type === 'loop');
      expect(loop.loopType).toBe('do-while');
    });
  });

  describe('allocation parsing', () => {
    it('should detect ArrayList creation', () => {
      const ir = parser.parse(`
public class Main {
    void foo() {
        ArrayList<Integer> list = new ArrayList<>();
    }
}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
    });

    it('should detect array creation', () => {
      const ir = parser.parse(`
public class Main {
    void foo(int n) {
        int[] arr = new int[n];
    }
}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
    });

    it('should detect HashMap creation', () => {
      const ir = parser.parse(`
public class Main {
    void foo() {
        HashMap<String, Integer> map = new HashMap<>();
    }
}
`);
      const alloc = ir.findFirst(n => n.type === 'allocation');
      expect(alloc).not.toBeNull();
    });
  });

  describe('call parsing', () => {
    it('should parse method invocations', () => {
      const ir = parser.parse(`
public class Main {
    void foo() {
        System.out.println("hello");
    }
}
`);
      const call = ir.findFirst(n => n.type === 'call');
      expect(call).not.toBeNull();
    });
  });

  describe('complex programs', () => {
    it('should parse nested loops (matrix traversal)', () => {
      const ir = parser.parse(`
public class Main {
    void traverse(int[][] matrix, int n) {
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                System.out.println(matrix[i][j]);
            }
        }
    }
}
`);
      const loops = ir.findAll(n => n.type === 'loop');
      expect(loops).toHaveLength(2);
    });

    it('should parse recursive method', () => {
      const ir = parser.parse(`
public class Main {
    int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }
}
`);
      expect(ir.functions).toHaveLength(1);
      const calls = ir.findAll(n => n.type === 'call');
      const recursiveCall = calls.find(c => c.functionName === 'factorial');
      expect(recursiveCall).toBeDefined();
    });
  });
});
