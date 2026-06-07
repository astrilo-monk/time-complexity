import fs from 'fs';
import { CppParser } from '../src/parsers/cpp/cpp-parser.js';
import { LoopAnalyzer } from '../src/analyzers/loop-analyzer.js';

const code = `void sort_n_times(int n) {
    for(int i=0;i<n;i++) {
        vector<int> v(n);
        sort(v.begin(), v.end());
    }
}`;

const parser = new CppParser();
const ir = parser.parse(code);

const loopAnalyzer = new LoopAnalyzer();
const result = loopAnalyzer.analyzeFunction(ir.functions[0]);

console.log("Result:", result);
