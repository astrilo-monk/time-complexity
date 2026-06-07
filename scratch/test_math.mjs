import { BigO } from '../src/core/complexity-algebra.js';

const n = BigO.N();
const nlogn = BigO.NLOGN();
const result = n.multiply(nlogn);

console.log("n * nlogn =", result.complexity);

const n2 = BigO.N2();
const logn = BigO.LOGN();
console.log("n2 * logn =", n2.multiply(logn).complexity);

// Test 53 test case
const nVar = new BigO('n');
const mVar = new BigO('m');
const kVar = new BigO('k');
const nm = nVar.multiply(mVar);
const nmk = nm.multiply(kVar);
console.log("n * m =", nm.complexity);
console.log("nm * k =", nmk.complexity);
