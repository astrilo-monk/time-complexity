# Complexity Analyzer

a zero-LLM static analysis engine that figures out the time and space complexity of your code by walking the AST. supports C, C++, Java, and Python.

## the backstory

this was built to replace a feature in Code Tracer[https://code-tracer-liart.vercel.app/] that used Groq's LLaMA 70B to estimate Big-O. prompting an LLM worked sometimes but it would hallucinate and contradict its own reasoning. so i built something that actually analyzes the code structure instead of guessing.

## quick start

```bash
npm install
npm test        # 200+ tests
node demo.js    # see it work
```

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

## how the pipeline works

```
source code (C/C++/Java/Python)
        │
        ▼
   tree-sitter          parses into concrete syntax tree
        │
        ▼
   IR builder           normalizes all languages into 12 common node types
        │
        ▼
  ┌─────┼─────────┬──────────┐
  ▼     ▼         ▼          ▼
loops  recursion  space   patterns     4 independent analyzers
  │     │         │          │
  └─────┼─────────┴──────────┘
        ▼
  complexity engine     merges results, picks dominant terms
        │
        ▼
  confidence engine     scores reliability (0-1) based on signals
        │
        ▼
  final report          Big-O + reasoning + confidence + patterns
```

each analyzer is independent. the loop analyzer doesn't know or care about the recursion analyzer. the engine runs all of them and merges the results.

## what it detects

### loops

| Pattern | Example | Result |
|---------|---------|--------|
| constant | `return a + b` | O(1) |
| single loop | `for(i=0; i<n; i++)` | O(n) |
| log loop | `for(i=1; i<n; i*=2)` | O(log n) |
| while halving | `while(n>1) n=n/2` | O(log n) |
| sqrt loop | `for(i=0; i*i<=n; i++)` | O(√n) |
| for-each | `for item in items` | O(n) |
| nested | `for i` -> `for j` | O(n²) |
| triple nested | `for i` -> `for j` -> `for k` | O(n³) |
| linear × log | `for(i)` -> `for(j*=2)` | O(n log n) |
| sequential | `O(n) then O(n²)` | O(n²) dominant |

### recursion

| Pattern | Example | Result |
|---------|---------|--------|
| linear | `f(n-1)` with O(1) work | O(n) |
| binary tree | `f(n-1) + f(n-2)` | O(2^n) |
| binary search | `f(n/2)` single call | O(log n) |
| merge sort | `2×f(n/2)` + O(n) merge | O(n log n) |
| with inner loop | `f(n-1)` + O(n) loop | O(n²) |
| tail recursion | `return f(n-1, acc)` | O(n) |
| exclusive branches | `f(n/2)` or `f(n-1)` in if/else | O(log n) |
| tower of hanoi | `f(n-1)` called twice | O(2^n) |

the recursion analyzer applies the **master theorem** automatically: `T(n) = a·T(n/b) + O(n^d)` with all 3 cases.

### space complexity

tracks allocations (`malloc`, `new`, arrays, collections), recursion stack depth, and loop amplification (allocation inside a loop multiplies the space).

### algorithm patterns

identifies what kind of algorithm the code looks like:

binary search, bubble sort, merge sort, divide and conquer, backtracking, two-pointer, matrix traversal, accumulation, linear search

these don't change the Big-O result, they just label the function.

## confidence scoring

every result has a confidence score between 0 and 1. it's based on positive signals ("bounds are statically known", "simple increment pattern") and negative signals ("has break statement", "unknown loop bounds"). each signal has a weight.

if confidence is low, the analyzer is telling you it's not sure. this is intentional - being honest about uncertainty is better than pretending to know.

## supported languages

| Language | Parser | Loops | Recursion | Space | Patterns |
|----------|--------|-------|-----------|-------|----------|
| C | ✓ | ✓ | ✓ | ✓ | ✓ |
| C++ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Java | ✓ | ✓ | ✓ | ✓ | ✓ |
| Python | ✓ | ✓ | ✓ | ✓ | ✓ |

## project structure

```
src/
├── parsers/          # tree-sitter adapters per language
│   ├── c/
│   ├── cpp/
│   ├── java/
│   └── python/
├── ir/               # common intermediate representation
│   ├── nodes.js      # 12 IR node types
│   └── builder.js    # call graph + recursion detection
├── analyzers/        # the actual brains
│   ├── loop-analyzer.js
│   ├── recursion-analyzer.js
│   ├── space-analyzer.js
│   └── pattern-detector.js
├── core/             # engine internals
│   ├── complexity-algebra.js   # Big-O math (multiply, add, compare)
│   ├── complexity-engine.js    # pipeline orchestrator
│   └── confidence-engine.js    # signal-based scoring
└── index.js          # public API
```

## known limitations

- **graph algorithms** - not graph-aware. dijkstra's and similar will get wrong answers
- **amortized analysis** - dynamic arrays, splay trees, etc. are unreliable
- **DP / memoization** - can't reason about cached subproblems
- **data structure costs** - doesn't know `HashMap.get()` is O(1) or `list.insert(0)` is O(n)
- **harmonic patterns** - `for(j=1; j<=n; j+=i)` is detected now but edge cases exist

## contributing

this is as far as i could take it on my own. if any of this interests you, i'd love help:

- graph algorithm awareness
- amortized analysis
- more languages (Go, Rust, JS)
- smarter pattern detection
- better space analysis for complex data structures

PRs, issues, even just telling me what's wrong - all welcome.

## docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) - system design
- [API.md](./API.md) - full API reference
- [CHANGELOG.md](./CHANGELOG.md) - version history

## license

MIT
