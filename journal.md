# dev journal

not really a formal doc, just writing down what i did each day so i don't forget stuff when i come back to this after a break.

---

## june 2, 2026

started the complexity analyzer project today. been wanting to build this for a while — the idea is basically a static analysis engine that can look at code and tell you the time complexity. not just some regex that matches `for` loops and says "O(n)" either, i want it to actually walk the AST and reason about it properly.

spent most of the day on the foundation:

- set up the project from scratch — esm modules, vitest for testing, tree-sitter for parsing
- designed the IR (intermediate representation). this took longer than expected. i had to figure out what node types i actually need. ended up with 12: ProgramNode, FunctionNode, LoopNode, BlockNode, BranchNode, CallNode, VariableNode, AllocationNode, ReturnNode, BreakNode, ContinueNode, ExpressionNode. might need more later but this covers everything i can think of rn
- wrote the base parser class. all 4 language parsers inherit from this. the main thing it does is `analyzeForLoopStructure()` — figures out if a loop is additive (i++), multiplicative (i*=2), or divisive (n/=2). this is critical because that's how you distinguish O(n) from O(log n)
- built parsers for python, c, c++, and java. each one walks the tree-sitter CST and converts it to my common IR

the python parser was the trickiest because `for i in range(n)` is technically a for-each loop but range(n) makes it a counted loop. had to detect range() calls and extract start/stop/step.

hit a nasty bug with embedded function calls. if you have `return n * factorial(n-1)`, the factorial call is buried inside a binary expression. the parser was only looking at direct children of the return statement. had to add `extractCallsFromExpression()` that recursively walks expression subtrees to find calls. had to add this to all 4 parsers.

also the c++ STL matching was wrong — `unordered_map` was matching as `map` because i used a Set and checked with `.includes()`. the iteration order meant `map` got checked first. fixed it by switching to a sorted array, longest names first.

ended the day with 95 tests passing. felt good.

## june 3, 2026

today was the big one — built the actual analysis engine.

phase 3 — core engine:
- `BigO` class — this is the math backbone. you can multiply complexities (for nested loops: O(n) × O(n) = O(n²)) and add them (for sequential code: O(n) + O(n²) = O(n²), dominant term wins). has a lookup table for multiplication results. also wrote a parser that handles formats like "O(n²)", "n^2", "O(n log n)" etc
- confidence engine — every analysis now gets a confidence score from 0 to 1. it works on signals: positive signals like "bounds are statically known" or "simple increment pattern" push the score up, negative signals like "has break statement" or "unknown bounds" push it down. each signal has a weight. i really like how this turned out, it makes the output feel honest instead of just guessing
- complexity engine — the orchestrator. takes source code, runs it through the parser, enriches the IR (marks recursive calls, builds call graph), then runs all registered analyzers and merges their results into one report

phase 4 — loop analyzer:
- this is where the actual complexity estimation happens. walks the IR tree and classifies each loop:
  - additive increment → O(n)
  - multiplicative increment → O(log n)  
  - for-each → O(n)
  - while with halving pattern (n = n/2) → O(log n)
  - while with decrement → O(n)
  - sqrt pattern (i*i <= n) → O(√n)
- nested loops get multiplied, sequential loops get added (dominant term)
- every analysis produces step-by-step reasoning. like for matrix multiplication it says "for-loop i=0 to n → O(n), inner for-loop j=0 to n → O(n), body is O(n) → total O(n²), outer loop O(n) × O(n²) = O(n³)". feels like how a TA would explain it

biggest bug today: bubble sort was returning O(1). turns out i forgot to implement `analyzeBranch()`. the loop analyzer had a switch case that called `this.analyzeBranch()` for if statements but the method didn't exist. since the engine wraps analyzer calls in try/catch, it silently failed and returned the error result. took me a bit to track down because the tests for simple nested loops (without if statements inside) all passed fine.

all 160 tests passing now across 10 test files. the demo script shows everything working end to end:
- python bubble sort → O(n²) ✓
- c++ log loop → O(log n) ✓
- java matrix multiply → O(n³) ✓
- while halving → O(log n) ✓
- sequential O(n) + O(n²) → O(n²) ✓

still need to build: recursion analyzer (for things like merge sort, fibonacci), space analyzer, algorithm pattern detector. but the hardest part is done honestly — the loop analyzer is the backbone of everything.

pushed everything to github. 4 out of 8 phases done.

## june 5, 2026

took a day off yesterday. came back today and knocked out phase 5 — the recursion analyzer.

this was actually cleaner to build than i expected. the hardest part was already done in phase 1: the IR builder already marks recursive calls and builds the call graph. so the recursion analyzer just needs to look at functions that have `isRecursive = true` and figure out what kind of recursion it is.

the approach:

1. count the recursive calls. 1 call = linear or divide. 2 calls = binary (fibonacci) or divide-and-conquer (merge sort). 3+ = exponential.
2. look at the arguments to figure out how the problem size shrinks. `f(n-1)` = subtractive. `f(n/2)` = halving. this is the key distinction — subtractive + 2 calls = O(2^n), halving + 2 calls = O(n log n).
3. detect tail recursion — if the recursive call is the last thing in the function (the return value IS the call), it's equivalent to a loop.
4. estimate the work done per call by checking for loops in the function body. a recursive function with an O(n) loop inside is doing more work per frame.
5. for halving recursion, apply the master theorem: T(n) = a·T(n/b) + O(n^d). there are 3 cases depending on how a compares to b^d.

patterns i can detect now:
- factorial: f(n-1) with O(1) work → O(n) 
- fibonacci: f(n-1) + f(n-2) → O(2^n) 
- binary search: f(n/2) single call → O(log n) 
- merge sort: 2×f(n/2) + O(n) merge → O(n log n)
- selection sort style: f(n-1) + O(n) loop → O(n²) 
- tail recursion: return f(n-1, acc) → O(n) 

the master theorem part was fun to implement. it's just 3 cases but it covers a surprisingly large chunk of CS textbook algorithms. had to be careful with floating point comparison for the "balanced" case (a = b^d) — used a tolerance of 0.01.

one thing i'm proud of: the reasoning output reads like a TA explaining it. for merge sort it says:
```
Function "merge_sort" is recursive.
Found 2 recursive call(s).
Base case detected.
Pattern: divide-and-conquer — 2 calls with n / 2.
Work per call: O(n) — loop found in the function body.
Master Theorem: T(n) = 2·T(n/2) + O(n)
  a=2, b=2, d=1, log_b(a)=1.00
  Case 2 (a = b^d): balanced → O(n log n).
```

all 175 tests passing across 11 test files. 15 new tests for recursion patterns.

5 out of 8 phases done. next up is space complexity analysis — that should be simpler since i already have AllocationNode in the IR for tracking memory allocations. might start phase 6 today night or tomorrow but will HAVE to stop due to exams

Phase 6 - Space Analyzer
building the space analyzer was conceptually simpler than time complexity, but required a few clever tricks. i realized early on that there are really only two sources of space usage we need to track:
1. **explicit allocations** - things like `malloc`, `new`, collections (`ArrayList`, `vector`), and arrays. the groundwork for this was already laid out in phase 1. the parsers were already emitting `AllocationNode`s with `sizeExpression` and `dataStructure` fields. i just needed to classify them.
2. **recursion stack depth** - every time a recursive call is made, it pushes a frame onto the call stack. so time complexity's recursion depth directly impacts space complexity. a linear recursion like `f(n-1)` takes O(n) stack space, while a halving recursion like `f(n/2)` takes O(log n) stack space.
the tricky part was parsing the size expressions for explicit allocations, especially in C/C++. for example, when someone writes `malloc(n * sizeof(int))`, my first naive version saw the `*` and classified it as O(n²), thinking `n * m` is quadratic. 
to fix this, i wrote an `extractSizeVariable()` method. its job is to strip away all the common wrappers (`malloc`, `calloc`, `sizeof`, `new`, cast operators) and extract just the core variable name. 
- `malloc(n * sizeof(int))` -> extracts `n` -> classifies as O(n). 
- only when two actual variables are multiplied, like `n * m` or `rows * cols`, does it count as O(n²).
another important piece was **loop amplification**. if you allocate memory *inside* a loop, the cumulative space grows. i used the existing loop depth tracking: a constant allocation O(1) inside a single loop becomes O(n) space. inside two nested loops, it becomes O(n²) space.
finally, i had to integrate this back into the main engine. i updated `complexity-engine.js` so it now calculates and merges space complexity alongside time. the final `AnalysisReport` now includes `spaceDisplay`, `spaceReasoning`, and `spaceConfidence` per function, giving a complete picture of the algorithm's performance.
added 14 new tests just for space patterns (testing arrays, heap allocations, loop amplification, and recursive stack limits), bringing the total to 189 passing tests.

after that i made a `demo-hard.js` file with 5 of the nastiest complexity patterns i could think of. wanted to stress test the analyzer and see where it breaks.
1. **dependent inner loop** - `for j < i` instead of `for j < n`. the total is the triangle sum 0+1+2+...+(n-1) = O(n^2). analyzer got it right because it treats the bound `i` as O(n) in the worst case.
2. **harmonic series** - inner loop runs `n/i` times. real answer is O(n log n) but we report O(n^2). can't detect harmonic sums yet, would need symbolic math for that. acceptable over-estimate for now.
3. **tower of hanoi** - two recursive calls both with n-1. got it right: O(2^n). also fixed the reasoning to say `2*T(n-1)` instead of `T(n-1) + T(n-2)` since both calls reduce by the same amount.
4. **fast exponentiation** - this one broke things initially. the function does `power(n/2)` in one branch and `power(n-1)` in another. two bugs:
   - the C parser wasn't finding `power(base, n/2)` because it was inside `int half = power(...)`. the parser created a VariableNode but threw away the call. fixed it to emit the CallNode as a child of the VariableNode.
   - the recursion analyzer saw 2 calls and classified it as binary recursion (O(2^n)). but the calls are in exclusive if/else branches - only one runs per invocation. added `analyzeReductionPerCall()` which checks each call's reduction pattern separately. if they differ (halving vs subtractive), it knows they're in different branches and treats it as a single call with the dominant (halving) reduction. result: O(log n). correct.
5. **subset generation** - backtracking with two sequential recursive calls. got it right: O(2^n).
final score: 5/5 PASS. pretty happy with that. the exclusive branch detection was a nice addition to the analyzer - it handles a whole class of divide-and-conquer algorithms that have a "fast path" and a "fallback path".

for fun i added dijkstra's algo and the output returned was n^2 for time , i knew my analyzer isn't graph aware but didn't knew this shit would be this deep , signing out before exams will work on this after exams or new backs :Brokenheart: 

## 06/06/2026
finished the last two phases today. project is now complete.
### phase 7 - algorithm pattern detector
this was a different kind of analyzer. the loop/recursion/space analyzers estimate *complexity*, but the pattern detector identifies *what algorithm* the code looks like. it doesn't change the Big-O result, it just labels the function with recognized patterns.
the approach is pure heuristic pattern matching against the IR tree structure. for each function, i run 9 detectors and collect all matches. a function can match multiple patterns - for example merge sort matches both "merge-sort" and "divide-and-conquer".
the 9 patterns and how i detect them:
1. **binary-search** - recursive f(n/2) with single call + branch, OR while loop with a `mid` variable.
2. **bubble-sort** - two nested for-loops where the inner has a branch with 2+ assignments (swap) or a `temp` declaration.
3. **merge-sort** - 2 recursive calls with n/2 reduction AND a loop (the merge step). without the loop it's just divide-and-conquer.
4. **divide-and-conquer** - 2+ recursive calls with halving arguments.
5. **backtracking** - 2 sequential recursive calls with subtractive reduction (index+1 or n-1). the "choose or skip" pattern.
6. **two-pointer** - while loop with paired pointer variables. i check for naming pairs: left/right, lo/hi, low/high, start/end, l/r, i/j.
7. **matrix-traversal** - triple nested loops (depth >= 3), or double nested with matrix-like variable names (dp, grid, matrix, etc.).
8. **accumulation** - single loop updating a variable with an accumulator-like name (sum, count, total, result, product, ans, etc.).
9. **linear-search** - single loop with a comparison branch that has a return or break (early exit on match).
hardest part was handling Python. Python doesn't have variable declarations - `count = 0` is an assignment, not a declaration. my accumulation detector was looking for `kind === 'declaration'` and missing all Python accumulators. fixed by checking both kinds and filtering by top-level children of the function body instead of all descendants.
17 new tests, 206 total. all passing.
### phase 8 - API documentation
wrote a complete API reference at `docs/API.md`. covers everything:
- `analyze()` function - the main entry point
- `getParser()`, `isLanguageSupported()`, `getSupportedLanguages()` utilities
- result types (AnalysisReport, FunctionReport) with all fields documented
- BigO class with factory methods, arithmetic, and comparison
- ComplexityEngine for custom pipeline setups
- ConfidenceEngine for signal-based scoring
- all 4 analyzers with their interfaces
- how to write a custom analyzer
- IR node types and tree traversal methods
- IR builder utilities
also updated README with the patterns table, ARCHITECTURE with the detector description, and CHANGELOG with v0.5.0.
all 8 phases done. 206 tests passing. the analyzer can now take code in 4 languages and tell you time complexity, space complexity, and what kind of algorithm it looks like. not bad for a week's work.

## 07/06/2026

big day. went from "the engine works" to "the engine explains itself properly".

### interactive CLI
added an interactive mode to `src/index.js`. you can now paste code directly into the terminal and get analysis results without needing a file. type `END` on its own line to finish input. small thing but makes the tool way more usable for quick checks.

### 71-test stress suite
built a massive `test.js` with 71 hand-written test cases covering everything the engine can handle. each test checks both time AND space complexity. the suite covers:
- basic loops (O(1) through O(n³))
- logarithmic patterns (binary search, sqrt loops)
- recursion (linear, binary, divide-and-conquer, exponential, tail)
- master theorem cases 1, 2, and 3
- space patterns (malloc, arrays, recursion stack, loop amplification)
- multi-language tests (C, C++, Java, Python) - treemap, priority queue, multiset, list comprehensions, dict comprehensions
- algorithm patterns - DFS, BFS, sliding window, geometric series, harmonic series
- multi-variable complexity (O(nm), O(nmk))
- tricky patterns - geometric series O(n), amortized sliding window O(n)

all 71 passing.

### reasoning fixes
this was the real meat of the day. the engine was getting the right answers but the reasoning output was lying about how it got there. three cases:

1. **sliding window (#70)** - the loop analyzer saw two nested while loops and printed "O(n) x O(n) = O(n^2)" in the reasoning, then the pattern detector silently overrode it to O(n). so the explanation proved O(n^2) and then said "answer: O(n)". fixed this by making the complexity engine clear contradictory reasoning when a pattern override fires. now it prints the actual two-pointer explanation: "pointer j advances bounded by n, pointer i advances bounded by n, total movements <= 2n".

2. **harmonic series (#52)** - the inner loop `for(j=1; j<=n; j+=i)` was being reported as "O(n) iterations". wrong. for a fixed i, it's n/i iterations. the total across all i is the harmonic sum n(1 + 1/2 + ... + 1/n) = O(n log n). added detection in the loop analyzer for when the increment variable matches an outer loop iterator. now correctly prints "step +i -> O(n/i) iterations".

3. **master theorem case 3 (#57)** - had the cases mixed up internally. the reasoning was printing case 1 conditions when it should have been case 3. fixed `applyMasterTheorem()` in the recursion analyzer to properly distinguish:
   - case 1 (recursion dominates): log_b(a) > d
   - case 2 (balanced): log_b(a) = d  
   - case 3 (work dominates): d > log_b(a)

the key insight from today: getting the right answer is only half the job. if the explanation doesn't match the answer, users will (rightfully) not trust the tool.

### architecture fixes
while building the test suite, found and fixed several deeper issues:
- space analyzer wasn't accounting for allocations inside recursive functions. an O(n) malloc inside O(n) linear recursion = O(n^2) space, not O(n). added stack depth amplification logic.
- allocation nodes now contribute to time complexity too. `malloc(n)` or creating a list of size n is O(n) time, not free.
- complexity algebra had bugs with multi-variable expressions. `O(n) * O(m)` was producing garbage. rewrote the multiply logic to handle variable combinations properly.

### repo cleanup
moved all test scripts, scratch files, debug outputs, and demo files into `.gitignore`. the tracked repo now only has source code, docs, and tests. merged `feat/user-given-code-2` into `main`.
