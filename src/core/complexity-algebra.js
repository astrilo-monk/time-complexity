/**
 * Complexity Algebra - Big-O arithmetic
 *
 * Provides a BigO class for representing, combining, and simplifying
 * asymptotic complexity expressions. This is the mathematical backbone
 * of the analysis engine.
 */

const COMPLEXITIES = [
  '1',
  'log log n',
  'log n',
  'log^2 n',
  'sqrt n',
  'n',
  'n sqrt n',
  'n log n',
  'n^2 log n',
  'n^2',
  'n^3',
  'n^4',
  '2^n',
  '3^n',
  '4^n',
  'n!',
];

const DISPLAY_NAMES = {
  '1':         'O(1)',
  'log log n': 'O(log log n)',
  'log n':     'O(log n)',
  'log^2 n':   'O(log² n)',
  'sqrt n':    'O(√n)',
  'n':         'O(n)',
  'n sqrt n':  'O(n√n)',
  'n log n':   'O(n log n)',
  'n^2':       'O(n²)',
  'n^3':       'O(n³)',
  'n^4':       'O(n⁴)',
  '2^n':       'O(2ⁿ)',
  '3^n':       'O(3ⁿ)',
  '4^n':       'O(4ⁿ)',
  'n!':        'O(n!)',
  'unknown':   'O(?)',
};

export class BigO {
  constructor(complexity, coefficient = 1) {
    this.coefficient = coefficient;
    
    let cStr = complexity.trim();
    if (cStr === 'unknown') {
      this.complexity = 'unknown';
      return;
    }

    if (COMPLEXITIES.includes(cStr)) {
      this.complexity = cStr;
      return;
    }

    // Normalize multi-variable additions: n+m
    if (/\+/.test(cStr)) {
      this.complexity = cStr.replace(/\s+/g, '');
      return;
    }

    // Normalize multi-variable multiplications: nm
    if (/\*/.test(cStr) || /^[a-zA-Z]{2}$/.test(cStr)) {
      this.complexity = cStr.replace(/\*/g, '');
      return;
    }

    this.complexity = cStr;
  }

  _getIndex(cStr) {
    if (cStr === 'unknown') return -1;
    if (COMPLEXITIES.includes(cStr)) return COMPLEXITIES.indexOf(cStr);

    if (/\+/.test(cStr)) return COMPLEXITIES.indexOf('n');
    if (/^[a-zA-Z]{2}$/.test(cStr)) return COMPLEXITIES.indexOf('n^2');

    if (/^[a-zA-Z]+$/.test(cStr)) return COMPLEXITIES.indexOf('n');
    if (/^log log [a-zA-Z]+$/.test(cStr)) return COMPLEXITIES.indexOf('log log n');
    if (/^log [a-zA-Z]+$/.test(cStr)) return COMPLEXITIES.indexOf('log n');
    if (/^sqrt [a-zA-Z]+$/.test(cStr)) return COMPLEXITIES.indexOf('sqrt n');
    if (/^([a-zA-Z]+) log \1$/.test(cStr)) return COMPLEXITIES.indexOf('n log n');
    if (/^([a-zA-Z]+) sqrt \1$/.test(cStr)) return COMPLEXITIES.indexOf('n sqrt n');

    return -1;
  }

  get orderIndex() {
    return this._getIndex(this.complexity);
  }

  // ─── Factory methods ─────────────────────────────────────

  static O1()      { return new BigO('1'); }
  static LOGLOGN(v='n'){ return new BigO(v === 'n' ? 'log log n' : `log log ${v}`); }
  static LOGN(v='n')   { return new BigO(v === 'n' ? 'log n' : `log ${v}`); }
  static LOG2N()   { return new BigO('log^2 n'); }
  static SQRTN(v='n')  { return new BigO(v === 'n' ? 'sqrt n' : `sqrt ${v}`); }
  static N(v='n')      { return new BigO(v); }
  static NSQRTN(v='n') { return new BigO(v === 'n' ? 'n sqrt n' : `${v} sqrt ${v}`); }
  static NLOGN(v='n')  { return new BigO(v === 'n' ? 'n log n' : `${v} log ${v}`); }
  static N2()      { return new BigO('n^2'); }
  static N3()      { return new BigO('n^3'); }
  static N4()      { return new BigO('n^4'); }
  static EXP()     { return new BigO('2^n'); }
  static FACT()    { return new BigO('n!'); }
  static UNKNOWN() { return new BigO('unknown'); }

  // ─── Arithmetic ──────────────────────────────────────────

  multiply(other) {
    if (this.isUnknown() || other.isUnknown()) return BigO.UNKNOWN();
    if (this.complexity === '1') return new BigO(other.complexity);
    if (other.complexity === '1') return new BigO(this.complexity);

    const key = this._multiplyKey(other);
    if (key in MULTIPLY_TABLE) return new BigO(MULTIPLY_TABLE[key]);
    const reverseKey = other._multiplyKey(this);
    if (reverseKey in MULTIPLY_TABLE) return new BigO(MULTIPLY_TABLE[reverseKey]);

    // Multi-variable (n * m -> mn)
    const isVar = (c) => (/^[a-zA-Z]+$/.test(c.complexity));
    if (isVar(this) && isVar(other) && this.complexity !== other.complexity) {
      if (/^[a-zA-Z]+$/.test(this.complexity) && /^[a-zA-Z]+$/.test(other.complexity)) {
        if (this.complexity === 'i' || this.complexity === 'j' || other.complexity === 'i' || other.complexity === 'j') {
          return BigO.N2();
        }
        let combinedVars = (this.complexity + other.complexity).split('').sort();
        return new BigO(combinedVars.join(''));
      }
    }

    // n * sqrt n -> n sqrt n
    if ((this.orderIndex === COMPLEXITIES.indexOf('n') && other.orderIndex === COMPLEXITIES.indexOf('sqrt n')) || 
        (this.orderIndex === COMPLEXITIES.indexOf('sqrt n') && other.orderIndex === COMPLEXITIES.indexOf('n'))) {
      if (this.complexity === other.complexity.split(' ')[1] || other.complexity === this.complexity.split(' ')[1]) {
        const v = this.complexity.split(' ')[1] || this.complexity;
        return BigO.NSQRTN(v);
      }
      return BigO.NSQRTN();
    }

    if (this.orderIndex >= COMPLEXITIES.indexOf('2^n') || other.orderIndex >= COMPLEXITIES.indexOf('2^n')) {
      return this.orderIndex >= other.orderIndex ? new BigO(this.complexity) : new BigO(other.complexity);
    }

    return this.orderIndex >= other.orderIndex ? new BigO(this.complexity) : new BigO(other.complexity);
  }

  add(other) {
    if (this.isUnknown() && other.isUnknown()) return BigO.UNKNOWN();
    if (this.isUnknown()) return new BigO(other.complexity);
    if (other.isUnknown()) return new BigO(this.complexity);

    if (this.complexity === other.complexity) {
      return new BigO(this.complexity);
    }

    // Multi-variable (n + m)
    if (this.orderIndex === COMPLEXITIES.indexOf('n') && other.orderIndex === COMPLEXITIES.indexOf('n')) {
      const vars = [...new Set([...this.complexity.split('+'), ...other.complexity.split('+')])];
      return new BigO(vars.join('+'));
    }

    return this.orderIndex >= other.orderIndex ? new BigO(this.complexity) : new BigO(other.complexity);
  }

  // ─── Comparison ──────────────────────────────────────────

  compare(other) { return this.orderIndex - other.orderIndex; }
  lessThan(other) { return this.orderIndex < other.orderIndex; }
  greaterThan(other) { return this.orderIndex > other.orderIndex; }
  equals(other) { return this.complexity === other.complexity; }

  // ─── Utilities ───────────────────────────────────────────

  isUnknown() { return this.complexity === 'unknown'; }
  isConstant() { return this.complexity === '1'; }
  isPolynomial() { 
    return this.orderIndex >= 0 && this.orderIndex <= COMPLEXITIES.indexOf('n^4'); 
  }

  toString() {
    if (DISPLAY_NAMES[this.complexity]) return DISPLAY_NAMES[this.complexity];
    return `O(${this.complexity})`;
  }

  toRaw() { return this.complexity; }

  _multiplyKey(other) { return `${this.complexity}*${other.complexity}`; }
}

const MULTIPLY_TABLE = {
  'n*n':           'n^2',
  'n*n^2':         'n^3',
  'n^2*n':         'n^3',
  'n*n^3':         'n^4',
  'n^3*n':         'n^4',
  'n^2*n^2':       'n^4',
  'n*log n':       'n log n',
  'log n*n':       'n log n',
  'n^2*log n':     'n^2 log n',
  'log n*n^2':     'n^2 log n',
  'n log n*n':     'n^2 log n',
  'n*n log n':     'n^2 log n',
  'log n*log n':   'log^2 n',
  'n log n*log n': 'n log n',
  'log n*n log n': 'n log n',
};

export function fromDegree(degree, varName = 'n') {
  switch (degree) {
    case 0: return BigO.O1();
    case 1: return BigO.N(varName);
    case 2: return BigO.N2();
    case 3: return BigO.N3();
    case 4: return BigO.N4();
    default:
      if (degree < 0) return BigO.O1();
      return BigO.N4();
  }
}

export function parse(str) {
  if (!str || typeof str !== 'string') return BigO.UNKNOWN();
  let s = str.trim().replace(/^O\(/, '').replace(/\)$/, '').trim();
  s = s.replace('²', '^2').replace('³', '^3').replace('⁴', '^4').replace('ⁿ', '^n');
  s = s.replace('√n', 'sqrt n');

  if (s === '1' || s === 'constant') return BigO.O1();
  if (s === 'log log n') return BigO.LOGLOGN();
  if (s === 'log n' || s === 'logn' || s === 'log(n)') return BigO.LOGN();
  if (s === 'sqrt n' || s === 'sqrt(n)') return BigO.SQRTN();
  if (s === 'n sqrt n') return BigO.NSQRTN();
  if (s === 'n') return BigO.N();
  if (s === 'n log n' || s === 'nlogn' || s === 'n*log(n)' || s === 'n log(n)') return BigO.NLOGN();
  if (s === 'n^2') return BigO.N2();
  if (s === 'n^3') return BigO.N3();
  if (s === 'n^4') return BigO.N4();
  if (s === '2^n') return BigO.EXP();
  if (s === 'n!' || s === 'n factorial') return BigO.FACT();

  return new BigO(s);
}

export function max(complexities) {
  if (!complexities || complexities.length === 0) return BigO.O1();
  let result = complexities[0];
  for (let i = 1; i < complexities.length; i++) {
    if (complexities[i].orderIndex > result.orderIndex) {
      result = complexities[i];
    }
  }
  return new BigO(result.complexity);
}
