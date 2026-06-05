/**
 * Complexity Algebra - Big-O arithmetic
 *
 * Provides a BigO class for representing, combining, and simplifying
 * asymptotic complexity expressions. This is the mathematical backbone
 * of the analysis engine.
 *
 * Supported complexities:
 *   O(1), O(log n), O(n), O(n log n), O(n²), O(n³), O(2ⁿ), O(n!)
 *
 * Operations:
 *   multiply - for nested loops: O(n) * O(n) = O(n²)
 *   add      - for sequential code: O(n) + O(n²) = O(n²) (dominant term)
 *   compare  - ordering complexities
 */

/**
 * Complexity class enumeration, ordered from smallest to largest.
 * The numeric value is used for comparison - higher = worse complexity.
 */
const COMPLEXITY_ORDER = {
  '1':       0,
  'log n':   1,
  'sqrt n':  2,
  'n':       3,
  'n log n': 4,
  'n^2':     5,
  'n^3':     6,
  'n^4':     7,
  '2^n':     8,
  'n!':      9,
  'unknown': -1,
};

/**
 * Display names for pretty printing.
 */
const DISPLAY_NAMES = {
  '1':       'O(1)',
  'log n':   'O(log n)',
  'sqrt n':  'O(√n)',
  'n':       'O(n)',
  'n log n': 'O(n log n)',
  'n^2':     'O(n²)',
  'n^3':     'O(n³)',
  'n^4':     'O(n⁴)',
  '2^n':     'O(2ⁿ)',
  'n!':      'O(n!)',
  'unknown': 'O(?)',
};

export class BigO {
  /**
   * @param {string} complexity - One of the keys in COMPLEXITY_ORDER
   * @param {number} [coefficient=1] - Leading coefficient (stripped in Big-O but useful for reasoning)
   */
  constructor(complexity, coefficient = 1) {
    if (!(complexity in COMPLEXITY_ORDER)) {
      throw new Error(`Unknown complexity class: "${complexity}". Valid: ${Object.keys(COMPLEXITY_ORDER).join(', ')}`);
    }
    this.complexity = complexity;
    this.coefficient = coefficient;
    this.order = COMPLEXITY_ORDER[complexity];
  }

  // ─── Factory methods ─────────────────────────────────────

  static O1()      { return new BigO('1'); }
  static LOGN()    { return new BigO('log n'); }
  static SQRTN()   { return new BigO('sqrt n'); }
  static N()       { return new BigO('n'); }
  static NLOGN()   { return new BigO('n log n'); }
  static N2()      { return new BigO('n^2'); }
  static N3()      { return new BigO('n^3'); }
  static N4()      { return new BigO('n^4'); }
  static EXP()     { return new BigO('2^n'); }
  static FACT()    { return new BigO('n!'); }
  static UNKNOWN() { return new BigO('unknown'); }

  // ─── Arithmetic ──────────────────────────────────────────

  /**
   * Multiply two complexities (used for nested loops).
   *
   * Rules:
   *   O(1)     * O(x)   = O(x)
   *   O(n)     * O(n)   = O(n²)
   *   O(n)     * O(n²)  = O(n³)
   *   O(n)     * O(log n) = O(n log n)
   *   O(log n) * O(log n) = O(log²n) ≈ O(log n) (simplified)
   *
   * @param {BigO} other
   * @returns {BigO}
   */
  multiply(other) {
    if (this.isUnknown() || other.isUnknown()) return BigO.UNKNOWN();

    // O(1) * anything = anything
    if (this.complexity === '1') return new BigO(other.complexity);
    if (other.complexity === '1') return new BigO(this.complexity);

    // Use the multiplication lookup table
    const key = this._multiplyKey(other);
    if (key in MULTIPLY_TABLE) {
      return new BigO(MULTIPLY_TABLE[key]);
    }

    // Reverse lookup
    const reverseKey = other._multiplyKey(this);
    if (reverseKey in MULTIPLY_TABLE) {
      return new BigO(MULTIPLY_TABLE[reverseKey]);
    }

    // If both are exponential or factorial, stay at the higher one
    if (this.order >= 8 || other.order >= 8) {
      return this.order >= other.order ? new BigO(this.complexity) : new BigO(other.complexity);
    }

    // Fallback: take the higher complexity
    return this.order >= other.order ? new BigO(this.complexity) : new BigO(other.complexity);
  }

  /**
   * Add two complexities (used for sequential code).
   * Returns the dominant (larger) term.
   *
   *   O(n) + O(n²) = O(n²)
   *   O(n) + O(n)  = O(n)
   *
   * @param {BigO} other
   * @returns {BigO}
   */
  add(other) {
    if (this.isUnknown() && other.isUnknown()) return BigO.UNKNOWN();
    if (this.isUnknown()) return new BigO(other.complexity);
    if (other.isUnknown()) return new BigO(this.complexity);

    // Dominant term wins
    if (this.order >= other.order) {
      return new BigO(this.complexity);
    }
    return new BigO(other.complexity);
  }

  // ─── Comparison ──────────────────────────────────────────

  /**
   * Compare this complexity with another.
   * @param {BigO} other
   * @returns {number} negative if this < other, 0 if equal, positive if this > other
   */
  compare(other) {
    return this.order - other.order;
  }

  /**
   * Check if this complexity is less than another.
   * @param {BigO} other
   * @returns {boolean}
   */
  lessThan(other) {
    return this.order < other.order;
  }

  /**
   * Check if this complexity is greater than another.
   * @param {BigO} other
   * @returns {boolean}
   */
  greaterThan(other) {
    return this.order > other.order;
  }

  /**
   * Check if this complexity equals another.
   * @param {BigO} other
   * @returns {boolean}
   */
  equals(other) {
    return this.complexity === other.complexity;
  }

  // ─── Utilities ───────────────────────────────────────────

  /**
   * Is this an unknown complexity?
   * @returns {boolean}
   */
  isUnknown() {
    return this.complexity === 'unknown';
  }

  /**
   * Is this constant time?
   * @returns {boolean}
   */
  isConstant() {
    return this.complexity === '1';
  }

  /**
   * Is this polynomial? (O(1) through O(n^4))
   * @returns {boolean}
   */
  isPolynomial() {
    return this.order >= 0 && this.order <= 7;
  }

  /**
   * Get the display string.
   * @returns {string}
   */
  toString() {
    return DISPLAY_NAMES[this.complexity] || `O(${this.complexity})`;
  }

  /**
   * Get the raw complexity string (without O() wrapper).
   * @returns {string}
   */
  toRaw() {
    return this.complexity;
  }

  /**
   * Generate a multiply table key for this pair.
   * @param {BigO} other
   * @returns {string}
   */
  _multiplyKey(other) {
    return `${this.complexity}*${other.complexity}`;
  }
}

/**
 * Multiplication lookup table for combining nested complexities.
 * Keys are "a*b" where a and b are complexity strings.
 */
const MULTIPLY_TABLE = {
  // n * n = n²
  'n*n':           'n^2',
  // n * n² = n³
  'n*n^2':         'n^3',
  'n^2*n':         'n^3',
  // n * n³ = n⁴
  'n*n^3':         'n^4',
  'n^3*n':         'n^4',
  // n² * n² = n⁴
  'n^2*n^2':       'n^4',
  // n * log n = n log n
  'n*log n':       'n log n',
  'log n*n':       'n log n',
  // n² * log n ≈ n² (dominant)
  'n^2*log n':     'n^2',
  'log n*n^2':     'n^2',
  // n log n * n = n² log n ≈ n² (simplified)
  'n log n*n':     'n^3',
  'n*n log n':     'n^3',
  // log n * log n ≈ log n (simplified - log²n grows slower than n)
  'log n*log n':   'log n',
  // n log n * log n ≈ n log n
  'n log n*log n': 'n log n',
  'log n*n log n': 'n log n',
};

// ─── Convenience functions ───────────────────────────────────

/**
 * Create a BigO from a polynomial degree.
 * @param {number} degree - 0=O(1), 1=O(n), 2=O(n²), 3=O(n³), 4=O(n⁴)
 * @returns {BigO}
 */
export function fromDegree(degree) {
  switch (degree) {
    case 0: return BigO.O1();
    case 1: return BigO.N();
    case 2: return BigO.N2();
    case 3: return BigO.N3();
    case 4: return BigO.N4();
    default:
      if (degree < 0) return BigO.O1();
      return BigO.N4(); // cap at n⁴
  }
}

/**
 * Parse a complexity string into a BigO.
 * Handles various formats: "O(n)", "O(n²)", "n^2", "n log n", etc.
 *
 * @param {string} str
 * @returns {BigO}
 */
export function parse(str) {
  if (!str || typeof str !== 'string') return BigO.UNKNOWN();

  // Strip O() wrapper and whitespace
  let s = str.trim();
  s = s.replace(/^O\(/, '').replace(/\)$/, '').trim();

  // Normalize unicode
  s = s.replace('²', '^2').replace('³', '^3').replace('⁴', '^4').replace('ⁿ', '^n');
  s = s.replace('√n', 'sqrt n');

  // Match known patterns
  if (s === '1' || s === 'constant') return BigO.O1();
  if (s === 'log n' || s === 'logn' || s === 'log(n)') return BigO.LOGN();
  if (s === 'sqrt n' || s === 'sqrt(n)') return BigO.SQRTN();
  if (s === 'n') return BigO.N();
  if (s === 'n log n' || s === 'nlogn' || s === 'n*log(n)' || s === 'n log(n)') return BigO.NLOGN();
  if (s === 'n^2') return BigO.N2();
  if (s === 'n^3') return BigO.N3();
  if (s === 'n^4') return BigO.N4();
  if (s === '2^n') return BigO.EXP();
  if (s === 'n!' || s === 'n factorial') return BigO.FACT();

  return BigO.UNKNOWN();
}

/**
 * Get the maximum (dominant) complexity from an array.
 * @param {BigO[]} complexities
 * @returns {BigO}
 */
export function max(complexities) {
  if (!complexities || complexities.length === 0) return BigO.O1();

  let result = complexities[0];
  for (let i = 1; i < complexities.length; i++) {
    if (complexities[i].order > result.order) {
      result = complexities[i];
    }
  }
  return new BigO(result.complexity);
}
