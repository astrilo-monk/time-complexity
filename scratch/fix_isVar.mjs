import fs from 'fs';

let algebra = fs.readFileSync('src/core/complexity-algebra.js', 'utf8');

algebra = algebra.replace(
  "const isVar = (c) => (c.orderIndex === COMPLEXITIES.indexOf('n') || (c.orderIndex === -1 && /^[a-zA-Z]+$/.test(c.complexity)));",
  "const isVar = (c) => (c.orderIndex === COMPLEXITIES.indexOf('n') || ((c.orderIndex === -1 || c.orderIndex === undefined) && /^[a-zA-Z]+$/.test(c.complexity)));"
);

fs.writeFileSync('src/core/complexity-algebra.js', algebra, 'utf8');
console.log("Fixed isVar!");
