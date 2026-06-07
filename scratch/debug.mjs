import { BigO } from '../src/core/complexity-algebra.js';

const n = BigO.N();
const nlogn = BigO.NLOGN();
console.log("n.complexity =", n.complexity, "n.orderIndex =", n.orderIndex);
console.log("nlogn.complexity =", nlogn.complexity, "nlogn.orderIndex =", nlogn.orderIndex);
console.log("n.multiply(nlogn).complexity =", n.multiply(nlogn).complexity);
console.log("n.multiply(nlogn).orderIndex =", n.multiply(nlogn).orderIndex);

const mVar = new BigO('m');
const kVar = new BigO('k');
console.log("mVar =", mVar.complexity, mVar.orderIndex);
console.log("kVar =", kVar.complexity, kVar.orderIndex);

const nm = n.multiply(mVar);
console.log("n * m =", nm.complexity, nm.orderIndex);
const nmk = nm.multiply(kVar);
console.log("nm * k =", nmk.complexity, nmk.orderIndex);

const multiTest1 = new BigO('mn');
const multiTest2 = new BigO('k');
console.log("mn * k =", multiTest1.multiply(multiTest2).complexity);
