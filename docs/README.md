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

**v0.1.0** — Foundation + Parser Layer

- [x] Project scaffolding and tooling
- [x] Common IR node types
- [x] Tree-sitter parser adapters for C, C++, Java, Python
- [ ] Loop analyzer
- [ ] Recursion analyzer
- [ ] Space analyzer
- [ ] Algorithm pattern detector
- [ ] Public API (`analyze()`)

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test
```

### Usage (current — parser layer only)

```javascript
import { getParser } from 'complexity-analyzer';

const parser = getParser('python');
const ir = parser.parse(`
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
`);

// ir is a ProgramNode with the full IR tree
console.log(ir.functions[0].name); // 'bubble_sort'
```

### Future API (coming in later phases)

```javascript
import { analyze } from 'complexity-analyzer';

const result = analyze(code, { language: 'python' });
// {
//   timeComplexity: "O(n²)",
//   spaceComplexity: "O(1)",
//   confidence: 0.94,
//   reasoning: [...],
//   detectedPatterns: [...]
// }
```

## Supported Languages

| Language | Parser Status | Analysis Status |
|----------|--------------|-----------------|
| C        | ✅ Done       | 🔲 Pending      |
| C++      | ✅ Done       | 🔲 Pending      |
| Java     | ✅ Done       | 🔲 Pending      |
| Python   | ✅ Done       | 🔲 Pending      |

## Project Structure

```
src/
├── parsers/          # Language-specific tree-sitter adapters
│   ├── c/
│   ├── cpp/
│   ├── java/
│   └── python/
├── ir/               # Common intermediate representation
├── analyzers/        # Loop, recursion, space, algorithm analyzers
├── core/             # Engine, confidence scoring, complexity math
└── api/              # Public API surface
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

## Development

```bash
npm install          # Install deps
npm test             # Run tests
npm run test:watch   # Watch mode
npm run lint         # Lint check
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed dev guide (coming soon).

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
