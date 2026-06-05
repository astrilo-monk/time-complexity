# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.4.0] - 05/06/2026

### Added

- Space Analyzer - memory usage estimation from IR structures
  - Allocation-based: detects malloc/calloc, new[], collections with size expressions
  - Size extraction: strips malloc(n * sizeof(int)) down to the variable 'n'
  - Quadratic detection: n*m or rows*cols allocations -> O(n^2)
  - Loop amplification: constant allocation inside loops -> O(n) cumulative
  - Recursion stack depth: linear (n-1) -> O(n), halving (n/2) -> O(log n)
  - Step-by-step space reasoning output
  - Space confidence scoring
- Engine now reports both time and space complexity per function and overall
- 14 new tests for space patterns
- Updated demo with space complexity output and malloc example

## [0.3.0] - 05/06/2026

### Added

- Recursion Analyzer - time complexity estimation from recursive structures
  - Linear recursion: f(n-1) with O(1) work → O(n)
  - Linear recursion with loops: f(n-1) with O(n) work → O(n²)
  - Binary recursion: f(n-1) + f(n-2) → O(2ⁿ) (Fibonacci-style)
  - Halving recursion: f(n/2) → O(log n) (binary search)
  - Divide-and-conquer: 2�-f(n/2) + O(n) merge → O(n log n) (merge sort)
  - Tail recursion detection → O(n)
  - Simplified Master Theorem (T(n) = a·T(n/b) + O(n^d))
  - Base case detection
  - Problem-size reduction pattern analysis (n-1, n/2, n//2)
  - Step-by-step reasoning for all recursion types
- RecursionAnalyzer registered in the analysis pipeline
- 15 new tests for recursion patterns
- Updated demo with recursion examples (factorial, fibonacci, binary search, merge sort)

## [0.2.0] - 03/06/2026

### Added

- Complexity Algebra module (`BigO` class) - multiply, add, compare, parse operations
- Confidence Engine - weighted signal-based scoring (0.0 to 1.0) with human-readable explanations
- Complexity Engine - analysis pipeline orchestrator (parse → IR → analyze → report)
- Loop Analyzer - time complexity estimation from loop structures
  - O(1) constant - no loops
  - O(log n) - multiplicative increment (`i *= 2`) or while-loop halving (`n /= 2`)
  - O(√n) - `i * i <= n` patterns
  - O(n) - single linear loop, for-each, while with decrement
  - O(n log n) - linear outer + logarithmic inner
  - O(n²) - two nested linear loops
  - O(n³) - three nested linear loops
  - O(n⁴) - four nested linear loops
- Branch analysis for if/else inside loops (worst-case path)
- Public `analyze()` convenience function wiring all analyzers
- Step-by-step reasoning output explaining how each complexity was derived
- 65 new tests (complexity algebra: 30, confidence engine: 11, loop analyzer: 24)
- Updated demo script showing full analysis pipeline output

## [0.1.0] - 02/06/2026

### Added

- Project scaffolding with ESM module structure
- Common IR (Intermediate Representation) node types
- IR builder utilities: recursive call marking, call graph construction, mutual recursion detection
- Tree-sitter parser adapter for C
- Tree-sitter parser adapter for C++
- Tree-sitter parser adapter for Java
- Tree-sitter parser adapter for Python
- Parser factory with language routing and caching
- Base parser class with shared loop analysis utilities
- Unit tests for IR nodes, parsers, and builder utilities
- Documentation: README, ARCHITECTURE, CHANGELOG
