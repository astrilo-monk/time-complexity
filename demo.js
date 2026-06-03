/**
 * Demo script — run with: node demo.js
 *
 * Shows the full analysis engine in action: source code → complexity estimate.
 */

import { analyze } from './src/index.js';

function printResult(title, code, language) {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ${title}`);
  console.log('═══════════════════════════════════════════════════════');

  const result = analyze(code, { language });

  for (const func of result.functions) {
    console.log(`  ${func.name}(${func.params.join(', ')})`);
    console.log(`    Time:       ${func.display}`);
    console.log(`    Confidence: ${func.confidence.score} (${func.confidence.level})`);
    console.log(`    Loop depth: ${func.loopDepth}`);
    console.log(`    Recursive:  ${func.isRecursive}`);
    if (func.reasoning.length > 0) {
      console.log('    Reasoning:');
      for (const r of func.reasoning) {
        console.log(`      ${r}`);
      }
    }
  }

  console.log(`  ─── Overall: ${result.overall.display}`);
  console.log();
}

// ─── O(1): Constant ──────────────────────────────────────────
printResult('Python — O(1) Constant', `
def add(a, b):
    return a + b
`, 'python');

// ─── O(n): Linear ────────────────────────────────────────────
printResult('C — O(n) Linear Sum', `
int sum(int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += i;
    }
    return total;
}
`, 'c');

// ─── O(log n): Logarithmic ──────────────────────────────────
printResult('C++ — O(log n) Binary Search Pattern', `
int logSearch(int n) {
    int count = 0;
    for (int i = 1; i < n; i *= 2) {
        count++;
    }
    return count;
}
`, 'cpp');

// ─── O(n²): Bubble Sort ────────────────────────────────────
printResult('Python — O(n²) Bubble Sort', `
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
`, 'python');

// ─── O(n log n): Linearithmic ───────────────────────────────
printResult('C — O(n log n) Linear × Log', `
void nlogn(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 1; j < n; j *= 2) {
            printf("%d %d", i, j);
        }
    }
}
`, 'c');

// ─── O(n³): Matrix Multiplication ──────────────────────────
printResult('Java — O(n³) Matrix Multiply', `
public class Matrix {
    void multiply(int n) {
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                for (int k = 0; k < n; k++) {
                    System.out.println(i + j + k);
                }
            }
        }
    }
}
`, 'java');

// ─── O(log n): While with halving ──────────────────────────
printResult('C — O(log n) While Halving', `
int halve(int n) {
    while (n > 1) {
        n = n / 2;
    }
    return n;
}
`, 'c');

// ─── Mixed: sequential loops ────────────────────────────────
printResult('C — Sequential O(n) + O(n²) = O(n²)', `
void mixed(int n) {
    for (int i = 0; i < n; i++) {
        printf("%d", i);
    }
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            printf("%d", j);
        }
    }
}
`, 'c');

console.log('═══════════════════════════════════════════════════════');
console.log('  ✅ Analysis engine working!');
console.log('═══════════════════════════════════════════════════════');
