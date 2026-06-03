# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-06-03

### Added

- Complexity Algebra module (`BigO` class) — multiply, add, compare, parse operations
- Confidence Engine — weighted signal-based scoring (0.0 to 1.0) with human-readable explanations
- Complexity Engine — analysis pipeline orchestrator (parse → IR → analyze → report)
- Loop Analyzer — time complexity estimation from loop structures
  - O(1) constant — no loops
  - O(log n) — multiplicative increment (`i *= 2`) or while-loop halving (`n /= 2`)
  - O(√n) — `i * i <= n` patterns
  - O(n) — single linear loop, for-each, while with decrement
  - O(n log n) — linear outer + logarithmic inner
  - O(n²) — two nested linear loops
  - O(n³) — three nested linear loops
  - O(n⁴) — four nested linear loops
- Branch analysis for if/else inside loops (worst-case path)
- Public `analyze()` convenience function wiring all analyzers
- Step-by-step reasoning output explaining how each complexity was derived
- 65 new tests (complexity algebra: 30, confidence engine: 11, loop analyzer: 24)
- Updated demo script showing full analysis pipeline output

## [0.1.0] - 2026-06-02

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
