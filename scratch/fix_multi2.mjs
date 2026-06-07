import fs from 'fs';

let algebra = fs.readFileSync('src/core/complexity-algebra.js', 'utf8');

const regex = /\/\/\s*Multi-variable \(n \* m -> nm\)[\s\S]*?return new BigO\(`\$\{this\.complexity\}\$\{other\.complexity\}`\);\s*\}\s*\}/;

const newMulti = `// Multi-variable (n * m -> mn)
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

algebra = algebra.replace(regex, newMulti);

fs.writeFileSync('src/core/complexity-algebra.js', algebra, 'utf8');
console.log("Fixed multi2!");
