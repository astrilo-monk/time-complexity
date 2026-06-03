/**
 * Tests for Complexity Algebra (BigO class)
 */

import { describe, it, expect } from 'vitest';
import { BigO, fromDegree, parse, max } from '../../../src/core/complexity-algebra.js';

describe('BigO', () => {
  describe('factory methods', () => {
    it('should create all complexity classes', () => {
      expect(BigO.O1().toString()).toBe('O(1)');
      expect(BigO.LOGN().toString()).toBe('O(log n)');
      expect(BigO.SQRTN().toString()).toBe('O(√n)');
      expect(BigO.N().toString()).toBe('O(n)');
      expect(BigO.NLOGN().toString()).toBe('O(n log n)');
      expect(BigO.N2().toString()).toBe('O(n²)');
      expect(BigO.N3().toString()).toBe('O(n³)');
      expect(BigO.N4().toString()).toBe('O(n⁴)');
      expect(BigO.EXP().toString()).toBe('O(2ⁿ)');
      expect(BigO.FACT().toString()).toBe('O(n!)');
      expect(BigO.UNKNOWN().toString()).toBe('O(?)');
    });

    it('should throw for invalid complexity', () => {
      expect(() => new BigO('bogus')).toThrow('Unknown complexity class');
    });
  });

  describe('comparison', () => {
    it('O(1) < O(n) < O(n²) < O(2ⁿ)', () => {
      expect(BigO.O1().lessThan(BigO.N())).toBe(true);
      expect(BigO.N().lessThan(BigO.N2())).toBe(true);
      expect(BigO.N2().lessThan(BigO.EXP())).toBe(true);
    });

    it('O(n²) > O(n log n) > O(n) > O(log n)', () => {
      expect(BigO.N2().greaterThan(BigO.NLOGN())).toBe(true);
      expect(BigO.NLOGN().greaterThan(BigO.N())).toBe(true);
      expect(BigO.N().greaterThan(BigO.LOGN())).toBe(true);
    });

    it('equals should work', () => {
      expect(BigO.N().equals(BigO.N())).toBe(true);
      expect(BigO.N().equals(BigO.N2())).toBe(false);
    });
  });

  describe('addition (sequential code)', () => {
    it('O(n) + O(n²) = O(n²)', () => {
      const result = BigO.N().add(BigO.N2());
      expect(result.complexity).toBe('n^2');
    });

    it('O(1) + O(n) = O(n)', () => {
      const result = BigO.O1().add(BigO.N());
      expect(result.complexity).toBe('n');
    });

    it('O(n) + O(n) = O(n)', () => {
      const result = BigO.N().add(BigO.N());
      expect(result.complexity).toBe('n');
    });

    it('unknown + O(n) = O(n)', () => {
      const result = BigO.UNKNOWN().add(BigO.N());
      expect(result.complexity).toBe('n');
    });

    it('unknown + unknown = unknown', () => {
      const result = BigO.UNKNOWN().add(BigO.UNKNOWN());
      expect(result.isUnknown()).toBe(true);
    });
  });

  describe('multiplication (nested code)', () => {
    it('O(n) × O(n) = O(n²)', () => {
      const result = BigO.N().multiply(BigO.N());
      expect(result.complexity).toBe('n^2');
    });

    it('O(n) × O(n²) = O(n³)', () => {
      const result = BigO.N().multiply(BigO.N2());
      expect(result.complexity).toBe('n^3');
    });

    it('O(n²) × O(n) = O(n³)', () => {
      const result = BigO.N2().multiply(BigO.N());
      expect(result.complexity).toBe('n^3');
    });

    it('O(n) × O(log n) = O(n log n)', () => {
      const result = BigO.N().multiply(BigO.LOGN());
      expect(result.complexity).toBe('n log n');
    });

    it('O(1) × O(n) = O(n)', () => {
      const result = BigO.O1().multiply(BigO.N());
      expect(result.complexity).toBe('n');
    });

    it('O(n) × O(1) = O(n)', () => {
      const result = BigO.N().multiply(BigO.O1());
      expect(result.complexity).toBe('n');
    });

    it('O(n²) × O(n²) = O(n⁴)', () => {
      const result = BigO.N2().multiply(BigO.N2());
      expect(result.complexity).toBe('n^4');
    });

    it('unknown × O(n) = unknown', () => {
      const result = BigO.UNKNOWN().multiply(BigO.N());
      expect(result.isUnknown()).toBe(true);
    });
  });

  describe('utilities', () => {
    it('isConstant', () => {
      expect(BigO.O1().isConstant()).toBe(true);
      expect(BigO.N().isConstant()).toBe(false);
    });

    it('isPolynomial', () => {
      expect(BigO.N2().isPolynomial()).toBe(true);
      expect(BigO.EXP().isPolynomial()).toBe(false);
    });

    it('isUnknown', () => {
      expect(BigO.UNKNOWN().isUnknown()).toBe(true);
      expect(BigO.N().isUnknown()).toBe(false);
    });

    it('toRaw returns raw string', () => {
      expect(BigO.N2().toRaw()).toBe('n^2');
    });
  });
});

describe('fromDegree', () => {
  it('should map degree to BigO', () => {
    expect(fromDegree(0).complexity).toBe('1');
    expect(fromDegree(1).complexity).toBe('n');
    expect(fromDegree(2).complexity).toBe('n^2');
    expect(fromDegree(3).complexity).toBe('n^3');
    expect(fromDegree(4).complexity).toBe('n^4');
  });

  it('should cap at n^4', () => {
    expect(fromDegree(10).complexity).toBe('n^4');
  });

  it('should return O(1) for negative', () => {
    expect(fromDegree(-1).complexity).toBe('1');
  });
});

describe('parse', () => {
  it('should parse standard formats', () => {
    expect(parse('O(1)').complexity).toBe('1');
    expect(parse('O(n)').complexity).toBe('n');
    expect(parse('O(n²)').complexity).toBe('n^2');
    expect(parse('O(n log n)').complexity).toBe('n log n');
    expect(parse('O(2ⁿ)').complexity).toBe('2^n');
    expect(parse('O(n!)').complexity).toBe('n!');
  });

  it('should parse raw formats', () => {
    expect(parse('n^2').complexity).toBe('n^2');
    expect(parse('log n').complexity).toBe('log n');
    expect(parse('1').complexity).toBe('1');
  });

  it('should return unknown for unparseable', () => {
    expect(parse('potato').isUnknown()).toBe(true);
    expect(parse('').isUnknown()).toBe(true);
    expect(parse(null).isUnknown()).toBe(true);
  });
});

describe('max', () => {
  it('should return the dominant complexity', () => {
    const result = max([BigO.O1(), BigO.N(), BigO.N2(), BigO.LOGN()]);
    expect(result.complexity).toBe('n^2');
  });

  it('should return O(1) for empty array', () => {
    expect(max([]).complexity).toBe('1');
  });
});
