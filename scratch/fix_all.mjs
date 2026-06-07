import fs from 'fs';

let algebra = fs.readFileSync('src/core/complexity-algebra.js', 'utf8');

// 1. Add missing complexities
algebra = algebra.replace(
  "  'n^2',\n  'n^3',\n  'n^4',",
  "  'n^2 log n',\n  'n^2',\n  'n^3',\n  'n^4',"
);

const oldMulti = `    // Multi-variable (n * m -> nm)
    if (this.orderIndex === COMPLEXITIES.indexOf('n') && other.orderIndex === COMPLEXITIES.indexOf('n') && 
this.complexity !== other.complexity) {
      if (/^[a-zA-Z]+$/.test(this.complexity) && /^[a-zA-Z]+$/.test(other.complexity)) {
        return new BigO(\`\${this.complexity}\${other.complexity}\`);
      }
    }`;

const newMulti = `    // Multi-variable (n * m -> mn)
    const isVar = (c) => (c.orderIndex === COMPLEXITIES.indexOf('n') || (c.orderIndex === -1 && /^[a-zA-Z]+$/.test(c.complexity)));
    if (isVar(this) && isVar(other) && this.complexity !== other.complexity) {
      if (/^[a-zA-Z]+$/.test(this.complexity) && /^[a-zA-Z]+$/.test(other.complexity)) {
        if (this.complexity === 'i' || this.complexity === 'j' || other.complexity === 'i' || other.complexity === 'j') {
          return BigO.N2();
        }
        let combinedVars = (this.complexity + other.complexity).split('').sort();
        return new BigO(combinedVars.join(''));
      }
    }`;

algebra = algebra.replace(oldMulti, newMulti);

fs.writeFileSync('src/core/complexity-algebra.js', algebra, 'utf8');
console.log("Fixed all!");
