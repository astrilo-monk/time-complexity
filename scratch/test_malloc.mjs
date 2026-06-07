import { analyze } from '../src/index.js';

const code = `void f(int n){
    if(n<=0) return;
    int *arr=malloc(n*sizeof(int));
    f(n-1);
}`;

const res = analyze(code, { language: 'c' });
console.log("Overall Time:", res.overall.display);
console.log(JSON.stringify(res.analyzerResults, null, 2));
