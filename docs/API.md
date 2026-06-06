# API Reference

Complete reference for the `complexity-analyzer` public API.

## Quick Start

```js
import { analyze } from 'complexity-analyzer';

const result = analyze(`
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
`, { language: 'python' });

console.log(result.functions[0].display);      // 'O(n^2)'
console.log(result.functions[0].spaceDisplay); // 'O(1)'
console.log(result.functions[0].confidence);   // { score: 1, level: 'high' }
console.log(result.functions[0].reasoning);
// [
//   'for-loop: i = 0 to n, step +1 -> O(n)',
//   '  for-loop: j = 0 to n - 1, step +1 -> O(n)',
//   '  Loop (for) runs O(n) iterations with O(1) body -> O(n)',
//   'Loop (for) runs O(n) iterations, body is O(n) -> total: O(n^2)'
// ]
```

---

## Top-Level Functions

### `analyze(sourceCode, options)`

The primary entry point. Parses the source code, runs all analyzers, and returns a structured report.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sourceCode` | `string` | Yes | The source code to analyze |
| `options.language` | `string` | Yes | Language identifier: `'c'`, `'cpp'`, `'java'`, or `'python'` |

**Returns:** `AnalysisReport` (see below)

**Throws:** `Error` if language is not specified or unsupported.

```js
import { analyze } from 'complexity-analyzer';
const result = analyze('int add(int a, int b) { return a + b; }', { language: 'c' });
```

---

### `getParser(language)`

Returns the parser instance for a given language. Useful when you want to inspect the IR directly.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `language` | `string` | `'c'`, `'cpp'`, `'java'`, or `'python'` |

**Returns:** Parser instance (extends `BaseParser`)

```js
import { getParser } from 'complexity-analyzer';
const parser = getParser('python');
const ir = parser.parse('def foo(): pass');
console.log(ir.functions[0].name); // 'foo'
```

---

### `isLanguageSupported(language)`

Check if a language is supported.

**Returns:** `boolean`

```js
import { isLanguageSupported } from 'complexity-analyzer';
isLanguageSupported('python'); // true
isLanguageSupported('rust');   // false
```

---

### `getSupportedLanguages()`

Returns array of supported language identifiers.

**Returns:** `string[]`

```js
import { getSupportedLanguages } from 'complexity-analyzer';
getSupportedLanguages(); // ['c', 'cpp', 'java', 'python']
```

---

## Result Types

### `AnalysisReport`

The top-level result returned by `analyze()`.

```ts
{
  language: string;                 // Source language
  functions: FunctionReport[];      // Per-function analysis
  overall: {
    timeComplexity: BigO;           // Max time across all functions
    display: string;                // e.g. 'O(n^2)'
    spaceComplexity: BigO;          // Max space across all functions
    spaceDisplay: string;           // e.g. 'O(n)'
  };
  metadata: {
    functionCount: number;          // Total functions found
    loopDepth: number;              // Max loop nesting depth
    hasRecursion: boolean;          // Any recursive function?
    hasMutualRecursion: boolean;    // Any mutual recursion detected?
  };
  analyzerResults: object[];        // Raw results from each analyzer
}
```

### `FunctionReport`

Per-function complexity report.

```ts
{
  name: string;                     // Function name
  params: string[];                 // Parameter names
  timeComplexity: BigO;             // Time complexity object
  display: string;                  // e.g. 'O(n log n)'
  spaceComplexity: BigO;            // Space complexity object
  spaceDisplay: string;             // e.g. 'O(n)'
  confidence: {
    score: number;                  // 0.0 to 1.0
    level: 'high' | 'medium' | 'low';
  };
  spaceConfidence: {
    score: number;
    level: 'high' | 'medium' | 'low';
  };
  isRecursive: boolean;             // Is this function recursive?
  loopDepth: number;                // Max loop nesting in this function
  reasoning: string[];              // Step-by-step time complexity reasoning
  spaceReasoning: string[];         // Step-by-step space reasoning
}
```

---

## Core Classes

### `BigO`

Represents an asymptotic complexity class. Supports arithmetic operations.

#### Factory Methods

| Method | Returns |
|--------|---------|
| `BigO.O1()` | O(1) - Constant |
| `BigO.LOGN()` | O(log n) - Logarithmic |
| `BigO.SQRTN()` | O(sqrt n) - Square root |
| `BigO.N()` | O(n) - Linear |
| `BigO.NLOGN()` | O(n log n) - Linearithmic |
| `BigO.N2()` | O(n^2) - Quadratic |
| `BigO.N3()` | O(n^3) - Cubic |
| `BigO.N4()` | O(n^4) - Quartic |
| `BigO.EXP()` | O(2^n) - Exponential |
| `BigO.FACT()` | O(n!) - Factorial |
| `BigO.UNKNOWN()` | Unknown complexity |

#### Methods

```js
import { BigO } from 'complexity-analyzer';

const n = BigO.N();
const logn = BigO.LOGN();

// Multiply (nested structures)
n.multiply(n);          // O(n^2)
n.multiply(logn);       // O(n log n)

// Add (sequential structures - dominant term wins)
n.add(BigO.N2());       // O(n^2)

// Compare
n.lessThan(BigO.N2());  // true
n.greaterThan(logn);    // true
n.equals(BigO.N());     // true

// Utilities
n.isConstant();         // false
n.isPolynomial();       // true
n.isUnknown();          // false
n.toString();           // 'O(n)'
n.toRaw();              // 'n'
```

#### Standalone Functions

```js
import { parseBigO, maxComplexity, fromDegree } from 'complexity-analyzer';

// Parse a string into BigO
parseBigO('O(n^2)');    // BigO { complexity: 'n^2' }
parseBigO('n log n');   // BigO { complexity: 'n log n' }
parseBigO('2^n');       // BigO { complexity: '2^n' }

// Get max from array
maxComplexity([BigO.N(), BigO.N2(), BigO.LOGN()]); // O(n^2)

// From polynomial degree
fromDegree(0);  // O(1)
fromDegree(2);  // O(n^2)
fromDegree(3);  // O(n^3)
```

---

### `ComplexityEngine`

The analysis pipeline orchestrator. Use this when you need custom analyzer configurations.

```js
import { ComplexityEngine, LoopAnalyzer, RecursionAnalyzer, SpaceAnalyzer } from 'complexity-analyzer';

const engine = new ComplexityEngine();
engine.use(new LoopAnalyzer());
engine.use(new RecursionAnalyzer());
engine.use(new SpaceAnalyzer());

const result = engine.analyze(code, { language: 'c' });
```

#### Methods

| Method | Description |
|--------|-------------|
| `use(analyzer)` | Register an analyzer. Chainable. |
| `analyze(sourceCode, options)` | Run the full pipeline. Returns `AnalysisReport`. |

---

### `ConfidenceEngine`

Signal-based confidence scoring system. Used internally by analyzers, but available for custom analyzers.

```js
import { ConfidenceEngine } from 'complexity-analyzer';

const confidence = new ConfidenceEngine();
confidence.addSignal('bounds_statically_known', 'Loop has constant bounds');
confidence.addSignal('has_break', 'Loop may terminate early');

const result = confidence.calculate();
// { score: 0.75, level: 'high', signals: [...] }
```

---

## Analyzers

All analyzers implement the same interface:

```js
{
  name: string;
  analyze(ir: ProgramNode, context: object): {
    analyzerName: string;
    functionResults: object[];
  }
}
```

### Built-in Analyzers

| Analyzer | What it detects |
|----------|----------------|
| `LoopAnalyzer` | Loop-based time complexity: O(1) through O(n^4) |
| `RecursionAnalyzer` | Recursive time complexity via Master Theorem |
| `SpaceAnalyzer` | Memory usage from allocations and recursion stack |
| `PatternDetector` | Algorithm archetypes (binary search, sorting, etc.) |

### Writing a Custom Analyzer

```js
class MyAnalyzer {
  constructor() {
    this.name = 'my-analyzer';
  }

  analyze(ir, context) {
    const functionResults = [];

    for (const func of ir.functions) {
      // Your analysis logic here
      functionResults.push({
        functionName: func.name,
        complexity: BigO.N(),
        confidence: { score: 0.8, level: 'high' },
        reasoning: ['Custom analysis found O(n) pattern.'],
      });
    }

    return { analyzerName: this.name, functionResults };
  }
}

// Register it
engine.use(new MyAnalyzer());
```

---

## IR Node Types

The Intermediate Representation is a tree of typed nodes. These are available for advanced use cases (building custom analyzers, inspecting parse results).

```js
import {
  ProgramNode,   // Root node, contains functions
  FunctionNode,  // Function/method definition
  LoopNode,      // for/while/do-while/for-each
  BlockNode,     // Block of statements
  BranchNode,    // if/else
  CallNode,      // Function call
  VariableNode,  // Variable declaration/assignment
  AllocationNode,// Memory allocation (malloc, new, collections)
  ReturnNode,    // return statement
  BreakNode,     // break
  ContinueNode,  // continue
  ExpressionNode,// Catch-all expression
} from 'complexity-analyzer';
```

### Key IR Properties

**FunctionNode:**
- `name` - Function name
- `params` - Parameter names array
- `body` - BlockNode containing the function body
- `isRecursive` - Set by `markRecursiveCalls()`
- `recursiveCalls` - Array of recursive CallNodes

**LoopNode:**
- `loopType` - `'for'`, `'while'`, `'do-while'`, or `'for-each'`
- `iteratorVar` - Loop variable name
- `boundVar` - Loop bound variable
- `incrementType` - `'additive'`, `'multiplicative'`, or `'unknown'`
- `incrementValue` - Step size

**CallNode:**
- `functionName` - Name of the called function
- `arguments` - Argument descriptions
- `isRecursive` - True if this is a recursive call

**AllocationNode:**
- `allocationType` - `'array'`, `'object'`, `'dynamic'`, or `'collection'`
- `dataStructure` - `'array'`, `'vector'`, `'map'`, `'set'`, `'heap'`, etc.
- `sizeExpression` - String describing the allocation size

### Tree Traversal

All IR nodes support tree walking:

```js
// Find all loops in a function
const loops = func.findAll(node => node.type === 'loop');

// Find first recursive call
const call = func.findFirst(node => node.type === 'call' && node.isRecursive);

// Walk the entire tree
func._walk(node => console.log(node.type));
```

---

## IR Builder Utilities

Post-parse utilities for enriching the IR.

```js
import {
  markRecursiveCalls,    // Mark recursive calls in all functions
  buildCallGraph,        // Build function -> callees map
  detectMutualRecursion, // Find mutual recursion cycles
  maxLoopDepth,          // Max loop nesting in a function
  collectLoops,          // All loops in a subtree
  collectAllocations,    // All allocations in a subtree
} from 'complexity-analyzer';

// Typical usage after parsing:
const parser = getParser('c');
const ir = parser.parse(code);
markRecursiveCalls(ir);
const callGraph = buildCallGraph(ir);
const cycles = detectMutualRecursion(callGraph);
```

---

## Supported Complexity Classes

The analyzer can detect and report these complexity classes:

| Class | Display | Common Examples |
|-------|---------|-----------------|
| O(1) | `O(1)` | Array access, arithmetic |
| O(log n) | `O(log n)` | Binary search, fast exponentiation |
| O(sqrt n) | `O(sqrt n)` | Trial division |
| O(n) | `O(n)` | Linear scan, single loop |
| O(n log n) | `O(n log n)` | Merge sort, heap sort |
| O(n^2) | `O(n^2)` | Bubble sort, nested loops |
| O(n^3) | `O(n^3)` | Matrix multiplication |
| O(n^4) | `O(n^4)` | Four nested loops |
| O(2^n) | `O(2^n)` | Fibonacci, subset generation |
| O(n!) | `O(n!)` | Permutations |

---

## Supported Languages

| Language | Identifier | Parser | Features |
|----------|-----------|--------|----------|
| C | `'c'` | tree-sitter-c | for/while/do-while, malloc/calloc, arrays |
| C++ | `'cpp'` | tree-sitter-cpp | Range-based for, STL containers, new/delete |
| Java | `'java'` | tree-sitter-java | Enhanced for, Java collections, array creation |
| Python | `'python'` | tree-sitter-python | range() detection, list/dict comprehensions |
