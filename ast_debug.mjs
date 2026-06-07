import { getParser } from './src/parsers/parser-factory.js';

const cpp = `void f(std::vector<int>& arr) { std::unordered_set<int> s; for(int x : arr) s.insert(x); }`;
const java = `void f(int n) { TreeMap<Integer, Integer> map = new TreeMap<>(); for(int i=0; i<n; i++) map.put(i, 1); }`;

async function run() {
  const pC = await getParser('cpp');
  const pJ = await getParser('java');
  
  const irC = pC.parse(cpp);
  const varsC = irC.functions[0].body.findAll(n => n.type === 'variable' || n.type === 'allocation');
  console.log("C++ vars:", JSON.stringify(varsC, null, 2));

  const irJ = pJ.parse(java);
  const varsJ = irJ.functions[0].body.findAll(n => n.type === 'variable' || n.type === 'allocation');
  console.log("Java vars:", JSON.stringify(varsJ, null, 2));
}

run();
