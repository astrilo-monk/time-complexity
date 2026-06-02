# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
