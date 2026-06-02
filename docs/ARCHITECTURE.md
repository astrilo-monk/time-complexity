# Architecture

## Overview

Complexity Analyzer is a multi-language static analysis engine. It takes source code as input, parses it into a common intermediate representation, runs multiple analysis passes, and produces structured complexity estimates with confidence scoring and reasoning.

```
Source Code (C/C++/Java/Python)
        │
        ▼
┌─────────────────┐
│  Parser Layer   │  tree-sitter CST → language-agnostic IR
│  (per language) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Intermediate   │  Normalized tree: Functions, Loops, Branches,
│  Representation │  Calls, Variables, Allocations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Analysis       │  Loop Analyzer, Recursion Analyzer,
│  Pipeline       │  Space Analyzer, Algorithm Detector
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Core Engine    │  Complexity algebra, confidence scoring,
│                 │  reasoning generation
└────────┬────────┘
         │
         ▼
    Structured Result (JSON)
```

## Layers

### Parser Layer (`src/parsers/`)

Each supported language has a parser adapter that extends `BaseParser`. The adapter uses tree-sitter with the language's grammar to parse source code into a Concrete Syntax Tree (CST), then walks the CST to produce IR nodes.

**Why tree-sitter?** It handles all the hard parts of parsing (operator precedence, error recovery, incremental parsing) and has maintained grammars for all our target languages. Writing parsers from scratch would be a multi-month effort with ongoing maintenance burden.

**What the adapters do:** They translate between tree-sitter's language-specific CST node types (which differ across languages) and our common IR. For example, a Python `for_statement` and a C `for_statement` have completely different CST structures, but both produce `LoopNode` instances in the IR.

`BaseParser` provides shared utilities like for-loop structure analysis (extracting iterator variable, bound, increment type) that work across C-like languages.

### Intermediate Representation (`src/ir/`)

The IR is a tree of typed nodes:

- `ProgramNode` — root, contains functions
- `FunctionNode` — function/method definition with name, params, body
- `LoopNode` — for/while/do-while/for-each with loop metadata
- `BranchNode` — if/else with condition and branches
- `CallNode` — function call with target name and arguments
- `VariableNode` — declaration or assignment
- `AllocationNode` — memory allocation (malloc, new, collections)
- `ReturnNode`, `BreakNode`, `ContinueNode` — control flow
- `ExpressionNode` — catch-all for other expressions

All nodes inherit from `IRNode`, which provides tree traversal (`findAll`, `findFirst`, `_walk`).

The IR also includes an `builder.js` module with post-parse utilities:
- Recursive call detection and marking
- Call graph construction
- Mutual recursion detection via cycle finding
- Loop depth counting

### Analysis Pipeline (`src/analyzers/`) — *Coming in later phases*

Each analyzer is independent and works against the IR:

- **Loop Analyzer** — Estimates loop complexity from loop metadata (O(1) through O(n³))
- **Recursion Analyzer** — Extracts recurrence relations, applies Master Theorem
- **Space Analyzer** — Estimates memory usage from allocations and recursion depth
- **Algorithm Detector** — Heuristic pattern matching for known algorithms

### Core Engine (`src/core/`) — *Coming in later phases*

- **Complexity Engine** — Orchestrates analyzers and combines their results
- **Complexity Algebra** — Big-O math (multiply, add, simplify, compare)
- **Confidence Engine** — Weighted signal-based confidence scoring

## Key Design Decisions

### Common IR over direct CST analysis

Analyzers work against the IR, not directly against tree-sitter CSTs. This means:
- Analyzers don't need to know about language-specific node types
- Adding a new language only requires writing a parser adapter
- Testing is simpler since we can construct IR nodes directly

The tradeoff is that the IR may lose some language-specific information. The parser adapters try to preserve anything relevant to complexity analysis (loop bounds, increment patterns, allocation types).

### Confidence scoring over false precision

Complexity analysis is undecidable in general (it reduces to the halting problem). Instead of pretending we can always give exact answers, every result includes a confidence score and explanation of what factors influenced it.

### Heuristic algorithm detection

Algorithm detection (Binary Search, Merge Sort, etc.) is inherently heuristic. We look for structural patterns in the IR, not exact code matches. This means false positives are possible. The confidence scoring system helps flag uncertain detections.

## Data Flow

```
1. User calls analyze(code, { language: 'python' })
2. ParserFactory returns PythonParser
3. PythonParser uses tree-sitter-python to parse → CST
4. PythonParser walks CST → IR (ProgramNode tree)
5. IR Builder marks recursive calls, builds call graph
6. Complexity Engine runs analyzers in sequence:
   a. Loop Analyzer → per-function loop complexities
   b. Recursion Analyzer → recurrence relations + solutions
   c. Space Analyzer → memory estimates
   d. Algorithm Detector → pattern matches
7. Complexity Algebra combines analyzer outputs
8. Confidence Engine scores the result
9. Reasoning generator produces human-readable explanations
10. Structured JSON result returned
```

## Extending the System

### Adding a new language

1. Install the tree-sitter grammar: `npm install tree-sitter-{lang}`
2. Create `src/parsers/{lang}/{lang}-parser.js` extending `BaseParser`
3. Map the grammar's CST node types to IR nodes
4. Add to `parser-factory.js`
5. Add test fixtures and parser tests

### Adding a new analyzer

1. Create `src/analyzers/{name}-analyzer.js`
2. Implement analysis against IR nodes
3. Return results that the Complexity Engine can combine
4. Add to the engine's pipeline in `complexity-engine.js`
