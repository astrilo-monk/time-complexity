# Time & Space Complexity Analyzer - 50 Hard Tracing Tests Report

**Overall Status**: 71 Passed / 0 Failed

## Summary Table

| ID | Test Name | Language | Status | Expected Time | Actual Time | Expected Space | Actual Space |
|---|---|---|---|---|---|---|---|
| 1 | 1. O(n) Basic Loop | c | PASS | O(n) | O(n) | O(1) | O(1) |
| 2 | 2. O(n^2) Nested Loop | c | PASS | O(n²) | O(n²) | O(1) | O(1) |
| 3 | 3. O(n^2) Dependent Loop | c | PASS | O(n²) | O(n²) | O(1) | O(1) |
| 4 | 4. O(n^3) Triple Loop | c | PASS | O(n³) | O(n³) | O(1) | O(1) |
| 5 | 5. O(n log n) Outer Loop, Inner Halving | c | PASS | O(n log n) | O(n log n) | O(1) | O(1) |
| 6 | 6. O(n log n) Outer Halving, Inner Loop | c | PASS | O(n log n) | O(n log n) | O(1) | O(1) |
| 7 | 7. O(log n) Halving Loop | c | PASS | O(log n) | O(log n) | O(1) | O(1) |
| 8 | 8. O(log n) Halving Division | c | PASS | O(log n) | O(log n) | O(1) | O(1) |
| 9 | 9. O(√n) Square Root Loop | c | PASS | O(√n) | O(√n) | O(1) | O(1) |
| 10 | 10. O(log log n) Double Halving | c | PASS | O(log log n) | O(log log n) | O(1) | O(1) |
| 11 | 11. O(n+m) Sequential Loops | c | PASS | O(n+m) | O(n+m) | O(1) | O(1) |
| 12 | 12. O(nm) Nested Mixed Variables | c | PASS | O(mn) | O(mn) | O(1) | O(1) |
| 13 | 13. O(n√n) Nested Root | c | PASS | O(n√n) | O(n√n) | O(1) | O(1) |
| 14 | 14. O(n/2) -> O(n) Loop | c | PASS | O(n) | O(n) | O(1) | O(1) |
| 15 | 15. O(n) Python For-Each | python | PASS | O(n) | O(n) | O(1) | O(1) |
| 16 | 16. O(n) Linear Recursion Time/Space | python | PASS | O(n) | O(n) | O(n) | O(n) |
| 17 | 17. O(n) Double Branch Recursion (Fibonacci-ish) | c | PASS | O(2ⁿ) | O(2ⁿ) | O(n) | O(n) |
| 18 | 18. O(log n) Halving Recursion (Binary Search style) | python | PASS | O(log n) | O(log n) | O(log n) | O(log n) |
| 19 | 19. O(n) Master Theorem Case 1 (2 calls, n/2) | c | PASS | O(n) | O(n) | O(log n) | O(log n) |
| 20 | 20. O(n log n) Master Theorem Case 2 (Merge Sort structure) | python | PASS | O(n log n) | O(n log n) | O(n) | O(n) |
| 21 | 21. O(log n) Binary Search (branched) | java | PASS | O(log n) | O(log n) | O(log n) | O(log n) |
| 22 | 22. O(n^2) Recursive with loop inside | c | PASS | O(n²) | O(n²) | O(n) | O(n) |
| 23 | 23. O(n log n) Master Theorem with loop | c | PASS | O(n log n) | O(n log n) | O(log n) | O(log n) |
| 24 | 24. O(n) Array Allocation | java | PASS | O(n) | O(n) | O(n) | O(n) |
| 25 | 25. O(n^2) 2D Array Allocation | java | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 26 | 26. O(n^2) Alloc inside Loop | java | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 27 | 27. O(1) Alloc inside Loop | java | PASS | O(n) | O(n) | O(n) | O(n) |
| 28 | 28. O(n) Collection Growth (.add) | java | PASS | O(n) | O(n) | O(n) | O(n) |
| 29 | 29. O(n) Python List Comprehension | python | PASS | O(n) | O(n) | O(n) | O(n) |
| 30 | 30. O(n^2) Python Nested Comprehension | python | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 31 | 31. O(n) Python Dict Frequency | python | PASS | O(n) | O(n) | O(n) | O(n) |
| 32 | 32. O(n^2) Python Slicing Trap | python | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 33 | 33. O(n) Python List Concatenation | python | PASS | O(n) | O(n) | O(n) | O(n) |
| 34 | 34. O(n) C++ Vector Growth | cpp | PASS | O(n) | O(n) | O(n) | O(n) |
| 35 | 35. O(n) HashMap Growth | java | PASS | O(n) | O(n) | O(n) | O(n) |
| 36 | 36. O(n log n) C++ std::sort | cpp | PASS | O(n log n) | O(n log n) | O(1) | O(1) |
| 37 | 37. O(n) C++ unordered_set insert | cpp | PASS | O(n) | O(n) | O(n) | O(n) |
| 38 | 38. O(n log n) C++ std::set insert | cpp | PASS | O(n log n) | O(n log n) | O(n) | O(n) |
| 39 | 39. O(n log n) C++ priority_queue push | cpp | PASS | O(n log n) | O(n log n) | O(n) | O(n) |
| 40 | 40. O(n log n) Java Arrays.sort | java | PASS | O(n log n) | O(n log n) | O(1) | O(1) |
| 41 | 41. O(n^2 log n) Loop + std::sort | cpp | PASS | O(n^2 log n) | O(n^2 log n) | O(1) | O(1) |
| 42 | 42. O(n^2 log n) Nested Priority Queue | cpp | PASS | O(n^2 log n) | O(n^2 log n) | O(n²) | O(n²) |
| 43 | 43. O(n^2) Double Slicing Recursion | python | PASS | O(2ⁿ) | O(2ⁿ) | O(n²) | O(n²) |
| 44 | 44. O(1) Function with Math | java | PASS | O(1) | O(1) | O(1) | O(1) |
| 45 | 45. O(n) Loop with Break | c | PASS | O(n) | O(n) | O(1) | O(1) |
| 46 | 46. O(n) Recursive Traversal (Binary Tree) | java | PASS | O(n) | O(n) | O(log n) | O(log n) |
| 47 | 47. O(n^2) Collection Growth inside Loop | python | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 48 | 48. O(n) Recursion with string building | java | PASS | O(n) | O(n) | O(n) | O(n) |
| 49 | 49. O(n log n) Tree Map insertions | java | PASS | O(n log n) | O(n log n) | O(n) | O(n) |
| 50 | 50. O(n) Iterative Linked List Traversal | cpp | PASS | O(n) | O(n) | O(1) | O(1) |
| 51 | 51. Geometric Series | c | PASS | O(n) | O(n) | O(1) | O(1) |
| 52 | 52. Harmonic Series | c | PASS | O(n log n) | O(n log n) | O(1) | O(1) |
| 53 | 53. Triple Variable | c | PASS | O(kmn) | O(kmn) | O(1) | O(1) |
| 54 | 54. Mixed Variables | c | PASS | O(mn) | O(mn) | O(1) | O(1) |
| 55 | 55. Log-Squared Recursion | c | PASS | O(log² n) | O(log² n) | O(log n) | O(log n) |
| 56 | 56. Ternary Recursion | c | PASS | O(3ⁿ) | O(3ⁿ) | O(n) | O(n) |
| 57 | 57. Master Theorem Case 3 | c | PASS | O(n²) | O(n²) | O(log n) | O(log n) |
| 58 | 58. Matrix Allocation | c | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 59 | 59. Recursive Matrix Allocation | c | PASS | O(n³) | O(n³) | O(n³) | O(n³) |
| 60 | 69. Recursive + Allocation | cpp | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 61 | 60. Python Deep Slice | python | PASS | O(n log n) | O(n log n) | O(n) | O(n) |
| 62 | 61. Python List Multiplication | python | PASS | O(n) | O(n) | O(n) | O(n) |
| 63 | 62. Python Nested Dict | python | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 64 | 63. Java TreeMap | java | PASS | O(n log n) | O(n log n) | O(n) | O(n) |
| 65 | 64. Java PriorityQueue | java | PASS | O(n log n) | O(n log n) | O(n) | O(n) |
| 66 | 65. C++ Multiset | cpp | PASS | O(n log n) | O(n log n) | O(n) | O(n) |
| 67 | 66. DFS Tree Traversal | cpp | PASS | O(n) | O(n) | O(log n) | O(log n) |
| 68 | 67. BFS | cpp | PASS | O(n) | O(n) | O(n) | O(n) |
| 69 | 68. Two Independent Recursive Calls | cpp | PASS | O(n) | O(n) | O(log n) | O(log n) |
| 70 | 69. Recursive + Allocation | c | PASS | O(n²) | O(n²) | O(n²) | O(n²) |
| 71 | 70. Sliding Window | cpp | PASS | O(n) | O(n) | O(1) | O(1) |
