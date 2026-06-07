import fs from 'fs';

let algebra = fs.readFileSync('src/core/complexity-algebra.js', 'utf8');

// Use an array parsing technique or just replace with \r?\n
algebra = algebra.replace(
  /  'n\^2',\r?\n  'n\^3',\r?\n  'n\^4',/,
  "  'n^2 log n',\n  'n^2',\n  'n^3',\n  'n^4',"
);

// We need to add n² log n to DISPLAY_NAMES just in case!
algebra = algebra.replace(
  /'n² log n': 'O\(n² log n\)',/,
  "'n^2 log n': 'O(n² log n)',\n  'n² log n': 'O(n² log n)',"
);

fs.writeFileSync('src/core/complexity-algebra.js', algebra, 'utf8');
console.log("Fixed complexities!");
