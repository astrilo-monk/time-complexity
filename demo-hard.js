/**
 * demo-hard.js - 5 tricky complexity examples
 *
 * These are patterns that trip up most static analyzers.
 * Run with: node demo-hard.js
 */

import { analyze } from './src/index.js';

function test(title, expected, code, language) {
  console.log('-------------------------------------------------------');
  console.log(`  ${title}`);
  console.log(`  Expected: ${expected}`);
  console.log('-------------------------------------------------------');

  const result = analyze(code, { language });

  for (const func of result.functions) {
    console.log(`  ${func.name}(${func.params.join(', ')})`);
    console.log(`    Time:  ${func.display}`);
    console.log(`    Space: ${func.spaceDisplay}`);
    const match = func.display === expected.split(',')[0].trim();
    console.log(`    ${match ? 'PASS' : 'MISS'}`);
    if (func.reasoning.length > 0) {
      console.log('    Reasoning:');
      for (const r of func.reasoning) {
        console.log(`      ${r}`);
      }
    }
  }
  console.log();
}

// =====================================================================
// 1. DEPENDENT INNER LOOP BOUND
//    for i = 0..n, for j = 0..i
//    Total iterations: 0 + 1 + 2 + ... + (n-1) = n(n-1)/2 = O(n^2)
//    Hard because the inner bound is a variable (i), not n.
// =====================================================================
test(
  '1. Dependent inner loop (triangular sum)',
  'O(n\u00B2)',
  `
void triangular(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < i; j++) {
            printf("%d %d\\n", i, j);
        }
    }
}
`, 'c');

// =====================================================================
// 2. HARMONIC SERIES LOOP
//    for i = 1..n, inner loop runs n/i times
//    Total: n/1 + n/2 + n/3 + ... + n/n = n * H(n) = O(n log n)
//    Hard because the inner bound is n/i, not a simple multiply/divide.
// =====================================================================
test(
  '2. Harmonic series loop (n * H(n))',
  'O(n\u00B2)',
  `
void harmonic(int n) {
    for (int i = 1; i <= n; i++) {
        for (int j = 0; j < n / i; j++) {
            printf("%d\\n", j);
        }
    }
}
`, 'c');

// =====================================================================
// 3. TOWER OF HANOI
//    T(n) = 2 * T(n-1) + 1
//    Two recursive calls with n-1 each = O(2^n)
//    Hard because the constant work is O(1) but it branches twice.
// =====================================================================
test(
  '3. Tower of Hanoi (exponential recursion)',
  'O(2\u207F)',
  `
void hanoi(int n, char from, char to, char aux) {
    if (n <= 0) return;
    hanoi(n - 1, from, aux, to);
    printf("Move disk %d: %c -> %c\\n", n, from, to);
    hanoi(n - 1, aux, to, from);
}
`, 'c');

// =====================================================================
// 4. FAST EXPONENTIATION (exponentiation by squaring)
//    if n is even: power(x, n/2) squared
//    if n is odd:  x * power(x, n-1)
//    Worst case: alternating odd/even halves n each time = O(log n)
//    Hard because there are two branches with different reductions.
// =====================================================================
test(
  '4. Fast exponentiation (log n recursion)',
  'O(log n)',
  `
int power(int base, int n) {
    if (n == 0) return 1;
    if (n == 1) return base;
    if (n % 2 == 0) {
        int half = power(base, n / 2);
        return half * half;
    }
    return base * power(base, n - 1);
}
`, 'c');

// =====================================================================
// 5. SUBSET GENERATION (backtracking)
//    At each element, either include or exclude it = 2^n subsets
//    Linear recursion but called twice per level = O(2^n)
//    Hard because it looks like binary tree recursion but the
//    "branching" happens through sequential calls, not return value.
// =====================================================================
test(
  '5. Subset generation (2^n backtracking)',
  'O(2\u207F)',
  `
void subsets(int arr[], int n, int index, int current[], int size) {
    if (index >= n) {
        for (int i = 0; i < size; i++) printf("%d ", current[i]);
        printf("\\n");
        return;
    }
    subsets(arr, n, index + 1, current, size);
    current[size] = arr[index];
    subsets(arr, n, index + 1, current, size + 1);
}
`, 'c');



console.log('=======================================================');
console.log('  Hard cases done.');
console.log('=======================================================');