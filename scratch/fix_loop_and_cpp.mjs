import fs from 'fs';

// 1. Fix loop-analyzer.js
let loop = fs.readFileSync('src/analyzers/loop-analyzer.js', 'utf8');

const oldVName = `    const { iteratorVar, boundVar, initValue, incrementType, incrementValue } = loop;
    const vName = boundVar && /^[a-zA-Z]+$/.test(boundVar) ? boundVar : 'n';`;

const newVName = `    const { iteratorVar, boundVar, initValue, incrementType, incrementValue } = loop;
    let vName = 'n';
    if (boundVar) {
      const clean = boundVar.replace(/\\s+/g, '');
      if (/^[a-zA-Z]+$/.test(clean)) {
        vName = clean;
      } else if (/^([a-zA-Z]+)\\*\\1$/.test(clean)) {
        vName = clean.split('*')[0] + '^2';
      } else if (/^([a-zA-Z]+)\\*\\1\\*\\1$/.test(clean)) {
        vName = clean.split('*')[0] + '^3';
      }
    }`;

loop = loop.replace(oldVName, newVName);
fs.writeFileSync('src/analyzers/loop-analyzer.js', loop, 'utf8');

// 2. Fix cpp-parser.js
let cpp = fs.readFileSync('src/parsers/cpp/cpp-parser.js', 'utf8');

const oldAlloc = `          alloc.dataStructure = containerType;
          alloc.name = varName;
          alloc.text = this.getNodeText(tsNode);
          return alloc;`;

const newAlloc = `          alloc.dataStructure = containerType;
          alloc.name = varName;
          alloc.text = this.getNodeText(tsNode);
          const sizeMatch = alloc.text.match(/\\b\\w+\\s*\\(\\s*([^,)]+)/);
          if (sizeMatch && !sizeMatch[1].includes('begin')) {
             alloc.sizeExpression = sizeMatch[1].trim();
          }
          return alloc;`;

cpp = cpp.replace(oldAlloc, newAlloc);
fs.writeFileSync('src/parsers/cpp/cpp-parser.js', cpp, 'utf8');

console.log("Fixed loop-analyzer and cpp-parser!");
