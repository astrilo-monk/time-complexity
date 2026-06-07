import { analyze } from './src/index.js';

const code = `
void allocInLoop(int n){
    for(int i=0;i<n;i++){
        int[] arr = new int[n];
    }
}
`;

const res = analyze(code, { language: 'java' });
console.log(JSON.stringify(res, null, 2));
