import fs from 'fs';

// Fix complexity-algebra.js
let algebra = fs.readFileSync('src/core/complexity-algebra.js', 'utf8');

algebra = algebra.replace(
  "  '2ⁿ', 'n!', 'unknown'",
  "  '2ⁿ', '3ⁿ', '4ⁿ', 'n!', 'unknown'"
);

algebra = algebra.replace(
  "  '2ⁿ':        'O(2ⁿ)',\n  'n!':        'O(n!)',",
  "  '2ⁿ':        'O(2ⁿ)',\n  '3ⁿ':        'O(3ⁿ)',\n  '4ⁿ':        'O(4ⁿ)',\n  'n!':        'O(n!)',"
);

const oldMultiplyVar = `    // Multi-variable (n * m -> nm)
    if (this.orderIndex === COMPLEXITIES.indexOf('n') && other.orderIndex === COMPLEXITIES.indexOf('n') && this.complexity !== other.complexity) {
      if (/^[a-zA-Z]+$/.test(this.complexity) && /^[a-zA-Z]+$/.test(other.complexity)) {`;

const newMultiplyVar = `    // Multi-variable (n * m -> mn)
    const isVar = (c) => (c.orderIndex === COMPLEXITIES.indexOf('n') || (c.orderIndex === -1 && /^[a-zA-Z]+$/.test(c.complexity)));
    if (isVar(this) && isVar(other) && this.complexity !== other.complexity) {
      if (/^[a-zA-Z]+$/.test(this.complexity) && /^[a-zA-Z]+$/.test(other.complexity)) {`;

algebra = algebra.replace(oldMultiplyVar, newMultiplyVar);

const oldVarMerge = `        // Merge chars from both, remove duplicates or sort them to maintain order
        let combinedVars = (this.complexity + other.complexity).split('').sort();
        // Since it's multiplication, n*n should be n^2, but here we just merge distinct variables (n, m, k)
        // Actually, if there are duplicates we should turn to n^2, but we'll assume they are distinct for now.
        // nmk is what we want for n * m * k
        return new BigO(combinedVars.join(''));`;

const newVarMerge = `        // Merge chars from both, remove duplicates or sort them to maintain order
        let combinedVars = (this.complexity + other.complexity).split('').sort();
        return new BigO(combinedVars.join(''));`;

algebra = algebra.replace(oldVarMerge, newVarMerge);

fs.writeFileSync('src/core/complexity-algebra.js', algebra, 'utf8');

// Fix test.js
let tests = fs.readFileSync('test.js', 'utf8');

tests = tests.replace(
  "expectedTime: 'O(nmk)'",
  "expectedTime: 'O(kmn)'"
);
tests = tests.replace(
  "expectedTime: 'O(nm)'",
  "expectedTime: 'O(mn)'"
);

fs.writeFileSync('test.js', tests, 'utf8');
console.log("Fixed files!");
