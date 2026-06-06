/**
 * user.js - Interactive complexity analyzer
 *
 * Paste your code, get time/space complexity and algorithm patterns.
 *
 * Usage:
 *   node user.js
 *   node user.js --lang python
 */

import { analyze, getSupportedLanguages } from './src/index.js';
import { createInterface } from 'readline';

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function printDivider() {
  console.log('\n' + '='.repeat(60));
}

function printResult(result) {
  printDivider();
  console.log('  ANALYSIS RESULT');
  printDivider();

  for (const func of result.functions) {
    console.log(`\n  Function: ${func.name}(${func.params.join(', ')})`);
    console.log(`  ${'─'.repeat(40)}`);
    console.log(`  Time Complexity:  ${func.display}`);
    console.log(`  Space Complexity: ${func.spaceDisplay}`);
    console.log(`  Confidence:       ${func.confidence.level} (${func.confidence.score})`);

    if (func.reasoning.length > 0) {
      console.log('\n  Reasoning:');
      for (const r of func.reasoning) {
        console.log(`    ${r}`);
      }
    }

    if (func.spaceReasoning.length > 0) {
      console.log('\n  Space Reasoning:');
      for (const r of func.spaceReasoning) {
        console.log(`    ${r}`);
      }
    }

    // Show detected patterns
    const patternResult = result.analyzerResults.find(
      a => a.analyzerName === 'pattern-detector'
    );
    if (patternResult) {
      const funcPatterns = patternResult.functionResults.find(
        r => r.functionName === func.name
      );
      if (funcPatterns && funcPatterns.patterns.length > 0) {
        console.log('\n  Algorithm Patterns:');
        for (const p of funcPatterns.patterns) {
          console.log(`    [${p.confidence}] ${p.pattern} - ${p.reasoning}`);
        }
      }
    }
  }

  if (result.functions.length > 1) {
    console.log(`\n  Overall: Time ${result.overall.display}, Space ${result.overall.spaceDisplay}`);
  }

  printDivider();
}

async function main() {
  const langArg = process.argv.find(a => a.startsWith('--lang='));
  const supported = getSupportedLanguages();

  console.log('============================================================');
  console.log('  Complexity Analyzer - Interactive Mode');
  console.log(`  Supported languages: ${supported.join(', ')}`);
  console.log('============================================================');

  let running = true;

  while (running) {
    console.log('');

    // Get language
    let language = langArg ? langArg.split('=')[1] : null;
    if (!language) {
      language = await ask(`  Language (${supported.join('/')}): `);
      language = language.trim().toLowerCase();
    }

    if (!supported.includes(language)) {
      console.log(`  Unsupported language "${language}". Try: ${supported.join(', ')}`);
      continue;
    }

    // Get code
    console.log('  Paste your code below (type END on a new line when done):');
    console.log('  ─────────────────────────────────────────────');

    let code = '';
    let line = '';
    while (true) {
      line = await ask('  ');
      if (line.trim().toLowerCase() === 'end') break;
      code += line + '\n';
    }

    if (code.trim().length === 0) {
      console.log('  No code provided.');
      continue;
    }

    // Analyze
    try {
      const result = analyze(code, { language });
      printResult(result);
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }

    // Continue?
    const again = await ask('\n  Analyze another? (y/n): ');
    if (again.trim().toLowerCase() !== 'y') {
      running = false;
    }
  }

  console.log('\n  Goodbye!\n');
  rl.close();
}

main();
