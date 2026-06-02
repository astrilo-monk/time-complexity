/**
 * Demo script — run with: node demo.js
 *
 * Shows the parser layer in action across all 4 languages.
 */

import { getParser } from './src/index.js';
import { markRecursiveCalls, buildCallGraph, maxLoopDepth } from './src/ir/builder.js';

// ─── Python: Bubble Sort ───────────────────────────────────
const pythonCode = `
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
`;

const pyParser = getParser('python');
const pyIR = pyParser.parse(pythonCode);
markRecursiveCalls(pyIR);

console.log('═══════════════════════════════════════');
console.log('  PYTHON — Bubble Sort');
console.log('═══════════════════════════════════════');
console.log(`Functions: ${pyIR.functions.map(f => f.name).join(', ')}`);
console.log(`Params:    ${pyIR.functions[0].params.join(', ')}`);

const pyLoops = pyIR.findAll(n => n.type === 'loop');
console.log(`Loops:     ${pyLoops.length}`);
for (const loop of pyLoops) {
  console.log(`  → ${loop.loopType} | iterator: ${loop.iteratorVar} | bound: ${loop.boundVar} | increment: ${loop.incrementType}`);
}
console.log(`Max loop depth: ${maxLoopDepth(pyIR.functions[0])}`);
console.log();

// ─── C: Factorial (Recursive) ──────────────────────────────
const cCode = `
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`;

const cParser = getParser('c');
const cIR = cParser.parse(cCode);
markRecursiveCalls(cIR);

console.log('═══════════════════════════════════════');
console.log('  C — Recursive Factorial');
console.log('═══════════════════════════════════════');
const cFunc = cIR.functions[0];
console.log(`Function:    ${cFunc.name}(${cFunc.params.join(', ')})`);
console.log(`Return type: ${cFunc.returnType}`);
console.log(`Recursive:   ${cFunc.isRecursive}`);
console.log(`Recursive calls: ${cFunc.recursiveCalls.length}`);

const cCalls = cIR.findAll(n => n.type === 'call');
console.log(`All calls: ${cCalls.map(c => `${c.functionName}(${c.arguments.join(', ')})`).join(', ')}`);
console.log();

// ─── C++: Logarithmic Loop ─────────────────────────────────
const cppCode = `
void search(int n) {
    vector<int> data;
    for (int i = 1; i < n; i *= 2) {
        data.push_back(i);
    }
}
`;

const cppParser = getParser('cpp');
const cppIR = cppParser.parse(cppCode);

console.log('═══════════════════════════════════════');
console.log('  C++ — Logarithmic Loop');
console.log('═══════════════════════════════════════');
const cppLoop = cppIR.findFirst(n => n.type === 'loop');
console.log(`Loop type:       ${cppLoop.loopType}`);
console.log(`Iterator:        ${cppLoop.iteratorVar}`);
console.log(`Init value:      ${cppLoop.initValue}`);
console.log(`Bound:           ${cppLoop.boundVar}`);
console.log(`Increment type:  ${cppLoop.incrementType}`);
console.log(`Increment value: ${cppLoop.incrementValue}`);

const cppAllocs = cppIR.findAll(n => n.type === 'allocation');
console.log(`Allocations: ${cppAllocs.map(a => a.dataStructure).join(', ')}`);
console.log();

// ─── Java: Nested Loops ────────────────────────────────────
const javaCode = `
public class Matrix {
    void multiply(int[][] a, int[][] b, int n) {
        int[][] result = new int[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                for (int k = 0; k < n; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }
    }
}
`;

const javaParser = getParser('java');
const javaIR = javaParser.parse(javaCode);

console.log('═══════════════════════════════════════');
console.log('  JAVA — Matrix Multiplication');
console.log('═══════════════════════════════════════');
const javaFunc = javaIR.functions[0];
console.log(`Method:         ${javaFunc.name}(${javaFunc.params.join(', ')})`);

const javaLoops = javaIR.findAll(n => n.type === 'loop');
console.log(`Loops:          ${javaLoops.length}`);
for (const loop of javaLoops) {
  console.log(`  → ${loop.loopType} | ${loop.iteratorVar} = ${loop.initValue} to ${loop.boundVar} | ${loop.incrementType} +${loop.incrementValue}`);
}
console.log(`Max loop depth: ${maxLoopDepth(javaFunc)}`);

const javaAllocs = javaIR.findAll(n => n.type === 'allocation');
console.log(`Allocations:    ${javaAllocs.map(a => `${a.dataStructure} (${a.allocationType})`).join(', ')}`);
console.log();

console.log('═══════════════════════════════════════');
console.log('  ✅ All parsers working!');
console.log('═══════════════════════════════════════');
