# Complexity Analyzer

A static program analysis engine that estimates time complexity, space complexity, recursion behavior, and algorithmic characteristics of source code — with explainable reasoning.

## What This Does

Given source code in C, C++, Java, or Python, the engine:

1. Parses the code into an AST using [tree-sitter](https://tree-sitter.github.io/tree-sitter/)
2. Builds a language-agnostic intermediate representation (IR)
3. Analyzes loops, recursion, memory usage, and algorithmic patterns
4. Estimates Big-O complexity with confidence scoring
5. Explains its reasoning step by step

This is **not** a simple pattern matcher. It performs structural AST analysis to understand how code actually executes.

## Current Status

**v0.2.0** — Core Engine + Loop Analysis

- [x] Project scaffolding and tooling
- [x] Common IR node types
- [x] Tree-sitter parser adapters for C, C++, Java, Python
- [x] Complexity algebra (Big-O math)
- [x] Confidence engine
- [x] Analysis engine (pipeline orchestrator)
- [x] Loop analyzer (O(1) through O(n⁴), log loops, while-halving)
- [ ] Recursion analyzer
- [ ] Space analyzer
- [ ] Algorithm pattern detector

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run the demo
node demo.js
```

### Usage

```javascript
import { analyze } from 'complexity-analyzer';

const result = analyze(`
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
`, { language: 'python' });

console.log(result.functions[0].display);      // 'O(n²)'
console.log(result.functions[0].confidence);    // { score: 1, level: 'high' }
console.log(result.functions[0].reasoning);
// [
//   'for-loop: i = 0 to n, step +1 → O(n)',
//   '  for-loop: j = 0 to n - 1, step +1 → O(n)',
//   '  Loop (for) runs O(n) iterations with O(1) body → O(n)',
//   'Loop (for) runs O(n) iterations, body is O(n) → total: O(n²)'
// ]
```

### What It Can Detect

| Pattern | Example | Result |
|---------|---------|--------|
| No loops | `return a + b` | O(1) |
| Single loop | `for(i=0; i<n; i++)` | O(n) |
| Log loop | `for(i=1; i<n; i*=2)` | O(log n) |
| While halving | `while(n>1) n=n/2` | O(log n) |
| For-each | `for item in items` | O(n) |
| Nested loops | `for i` → `for j` | O(n²) |
| Triple nested | `for i` → `for j` → `for k` | O(n³) |
| Linear × log | `for(i)` → `for(j*=2)` | O(n log n) |
| Sequential | `O(n) then O(n²)` | O(n²) |

## Supported Languages

| Language | Parser | Loop Analysis |
|----------|--------|---------------|
| C        | ✅ Done | ✅ Done        |
| C++      | ✅ Done | ✅ Done        |
| Java     | ✅ Done | ✅ Done        |
| Python   | ✅ Done | ✅ Done        |

## Project Structure

```
src/
├── parsers/          # Language-specific tree-sitter adapters
│   ├── c/
│   ├── cpp/
│   ├── java/
│   └── python/
├── ir/               # Common intermediate representation
│   ├── nodes.js      # 12 IR node types
│   └── builder.js    # Call graph, recursion detection
├── analyzers/        # Analysis modules
│   └── loop-analyzer.js
├── core/             # Engine internals
│   ├── complexity-algebra.js   # Big-O arithmetic
│   ├── complexity-engine.js    # Pipeline orchestrator
│   └── confidence-engine.js    # Signal-based scoring
└── index.js          # Public API entry point
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

## Development

```bash
npm install          # Install deps
npm test             # Run all 160 tests
node demo.js         # See the engine in action
```

## Design Goals

1. **API-first** — Designed for programmatic consumption, not just CLI output
2. **Modular** — Each analyzer is independent and composable
3. **Extensible** — Adding a new language or analyzer should be straightforward
4. **Honest** — Confidence scoring and documented limitations over false precision
5. **Explainable** — Every result includes step-by-step reasoning

## Integration with Code Tracer

This project is designed to be imported as a module:

```javascript
import { analyze } from 'complexity-analyzer';
```

The analysis engine has zero UI dependencies and returns plain JSON objects.

## License

MIT
