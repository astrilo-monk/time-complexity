### phase 6 - space analyzer implementation details

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
