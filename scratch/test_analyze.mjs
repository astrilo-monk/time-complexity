import { analyze } from '../src/index.js';

const code = `void sort_n_times(int n) {
    for(int i=0;i<n;i++) {
        vector<int> v(n);
        sort(v.begin(), v.end());
    }
}`;

const res = analyze(code, { language: 'cpp' });
console.log("Overall Time:", res.overall.display);
console.log("Overall Space:", res.overall.spaceDisplay);
console.log(JSON.stringify(res, null, 2));
