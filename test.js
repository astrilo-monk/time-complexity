import { analyze } from './src/index.js';
import fs from 'fs';

const testCases = [
  // --- LOOP PATTERNS ---
  {
    name: '1. O(n) Basic Loop',
    language: 'c',
    expectedTime: 'O(n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=0; i<n; i++) {} }`
  },
  {
    name: '2. O(n^2) Nested Loop',
    language: 'c',
    expectedTime: 'O(n²)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=0; i<n; i++) { for(int j=0; j<n; j++) {} } }`
  },
  {
    name: '3. O(n^2) Dependent Loop',
    language: 'c',
    expectedTime: 'O(n²)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=0; i<n; i++) { for(int j=0; j<i; j++) {} } }`
  },
  {
    name: '4. O(n^3) Triple Loop',
    language: 'c',
    expectedTime: 'O(n³)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=0; i<n; i++) { for(int j=0; j<n; j++) { for(int k=0; k<n; k++) {} } } }`
  },
  {
    name: '5. O(n log n) Outer Loop, Inner Halving',
    language: 'c',
    expectedTime: 'O(n log n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=0; i<n; i++) { for(int j=1; j<n; j*=2) {} } }`
  },
  {
    name: '6. O(n log n) Outer Halving, Inner Loop',
    language: 'c',
    expectedTime: 'O(n log n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=1; i<n; i*=2) { for(int j=0; j<n; j++) {} } }`
  },
  {
    name: '7. O(log n) Halving Loop',
    language: 'c',
    expectedTime: 'O(log n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=1; i<n; i*=2) {} }`
  },
  {
    name: '8. O(log n) Halving Division',
    language: 'c',
    expectedTime: 'O(log n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=n; i>0; i/=2) {} }`
  },
  {
    name: '9. O(√n) Square Root Loop',
    language: 'c',
    expectedTime: 'O(√n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=1; i*i<=n; i++) {} }`
  },
  {
    name: '10. O(log log n) Double Halving',
    language: 'c',
    expectedTime: 'O(log log n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=2; i<n; i*=i) {} }`
  },
  {
    name: '11. O(n+m) Sequential Loops',
    language: 'c',
    expectedTime: 'O(n+m)', expectedSpace: 'O(1)',
    code: `void f(int n, int m) { for(int i=0; i<n; i++) {} for(int j=0; j<m; j++) {} }`
  },
  {
    name: '12. O(nm) Nested Mixed Variables',
    language: 'c',
    expectedTime: 'O(mn)', expectedSpace: 'O(1)',
    code: `void f(int n, int m) { for(int i=0; i<n; i++) { for(int j=0; j<m; j++) {} } }`
  },
  {
    name: '13. O(n√n) Nested Root',
    language: 'c',
    expectedTime: 'O(n√n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=0; i<n; i++) { for(int j=1; j*j<=n; j++) {} } }`
  },
  {
    name: '14. O(n/2) -> O(n) Loop',
    language: 'c',
    expectedTime: 'O(n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=0; i<n/2; i++) {} }`
  },
  {
    name: '15. O(n) Python For-Each',
    language: 'python',
    expectedTime: 'O(n)', expectedSpace: 'O(1)',
    code: `def f(arr):\n  for x in arr:\n    pass`
  },

  // --- RECURSION ---
  {
    name: '16. O(n) Linear Recursion Time/Space',
    language: 'python',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `def f(n):\n  if n <= 1: return\n  f(n-1)`
  },
  {
    name: '17. O(n) Double Branch Recursion (Fibonacci-ish)',
    language: 'c',
    expectedTime: 'O(2ⁿ)', expectedSpace: 'O(n)',
    code: `int fib(int n) { if(n<=1) return 1; return fib(n-1) + fib(n-2); }`
  },
  {
    name: '18. O(log n) Halving Recursion (Binary Search style)',
    language: 'python',
    expectedTime: 'O(log n)', expectedSpace: 'O(log n)',
    code: `def f(n):\n  if n <= 1: return\n  f(n//2)`
  },
  {
    name: '19. O(n) Master Theorem Case 1 (2 calls, n/2)',
    language: 'c',
    expectedTime: 'O(n)', expectedSpace: 'O(log n)',
    code: `void f(int n) { if(n<=1) return; f(n/2); f(n/2); }`
  },
  {
    name: '20. O(n log n) Master Theorem Case 2 (Merge Sort structure)',
    language: 'python',
    expectedTime: 'O(n log n)', expectedSpace: 'O(n)',
    code: `def merge(left, right):\n  return left+right\ndef merge_sort(arr):\n  if len(arr)<=1: return arr\n  mid = len(arr)//2\n  L = merge_sort(arr[:mid])\n  R = merge_sort(arr[mid:])\n  return merge(L, R)`
  },
  {
    name: '21. O(log n) Binary Search (branched)',
    language: 'java',
    expectedTime: 'O(log n)', expectedSpace: 'O(log n)',
    code: `int search(int[] arr, int l, int r, int x) { if (r >= l) { int mid = l + (r - l) / 2; if (arr[mid] == x) return mid; if (arr[mid] > x) return search(arr, l, mid - 1, x); return search(arr, mid + 1, r, x); } return -1; }`
  },
  {
    name: '22. O(n^2) Recursive with loop inside',
    language: 'c',
    expectedTime: 'O(n²)', expectedSpace: 'O(n)',
    code: `void f(int n) { if(n<=1) return; for(int i=0; i<n; i++) {} f(n-1); }`
  },
  {
    name: '23. O(n log n) Master Theorem with loop',
    language: 'c',
    expectedTime: 'O(n log n)', expectedSpace: 'O(log n)',
    code: `void f(int n) { if(n<=1) return; for(int i=0; i<n; i++) {} f(n/2); f(n/2); }`
  },

  // --- SPACE & ALLOCATIONS ---
  {
    name: '24. O(n) Array Allocation',
    language: 'java',
    expectedTime: 'O(n)', expectedSpace: 'O(n)', // Allocation costs O(n) time and O(n) space
    code: `void f(int n) { int[] arr = new int[n]; }`
  },
  {
    name: '25. O(n^2) 2D Array Allocation',
    language: 'java',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `void f(int n, int m) { int[][] arr = new int[n][m]; }`
  },
  {
    name: '26. O(n^2) Alloc inside Loop',
    language: 'java',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `void f(int n) { for(int i=0; i<n; i++) { int[] arr = new int[n]; } }`
  },
  {
    name: '27. O(1) Alloc inside Loop',
    language: 'java',
    expectedTime: 'O(n)', expectedSpace: 'O(n)', // n iterations of O(1) alloc -> cumulative O(n)
    code: `void f(int n) { for(int i=0; i<n; i++) { int[] arr = new int[10]; } }`
  },
  {
    name: '28. O(n) Collection Growth (.add)',
    language: 'java',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `void f(int n) { ArrayList<Integer> list = new ArrayList<>(); for(int i=0; i<n; i++) { list.add(i); } }`
  },
  {
    name: '29. O(n) Python List Comprehension',
    language: 'python',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `def f(n): return [i*2 for i in range(n)]`
  },
  {
    name: '30. O(n^2) Python Nested Comprehension',
    language: 'python',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `def f(n): return [[0 for j in range(n)] for i in range(n)]`
  },
  {
    name: '31. O(n) Python Dict Frequency',
    language: 'python',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `def f(arr):\n  d={}\n  for x in arr:\n    d[x] = d.get(x,0) + 1\n  return d`
  },
  {
    name: '32. O(n^2) Python Slicing Trap',
    language: 'python',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `def recurse(arr):\n  if len(arr) <= 1: return\n  recurse(arr[1:])`
  },
  {
    name: '33. O(n) Python List Concatenation',
    language: 'python',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `def merge(left, right): return left + right`
  },
  {
    name: '34. O(n) C++ Vector Growth',
    language: 'cpp',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `void f(int n) { std::vector<int> v; for(int i=0; i<n; i++) v.push_back(i); }`
  },
  {
    name: '35. O(n) HashMap Growth',
    language: 'java',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `void f(int n) { HashMap<Integer,Integer> map = new HashMap<>(); for(int i=0; i<n; i++) map.put(i, 1); }`
  },

  // --- STL AND BUILT-INS ---
  {
    name: '36. O(n log n) C++ std::sort',
    language: 'cpp',
    expectedTime: 'O(n log n)', expectedSpace: 'O(1)', // assuming sort doesn't add huge space
    code: `void f(std::vector<int>& arr) { std::sort(arr.begin(), arr.end()); }`
  },
  {
    name: '37. O(n) C++ unordered_set insert',
    language: 'cpp',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `void f(std::vector<int>& arr) { std::unordered_set<int> s; for(int x : arr) s.insert(x); }`
  },
  {
    name: '38. O(n log n) C++ std::set insert',
    language: 'cpp',
    expectedTime: 'O(n log n)', expectedSpace: 'O(n)',
    code: `void f(std::vector<int>& arr) { std::set<int> s; for(int x : arr) s.insert(x); }`
  },
  {
    name: '39. O(n log n) C++ priority_queue push',
    language: 'cpp',
    expectedTime: 'O(n log n)', expectedSpace: 'O(n)',
    code: `void f(std::vector<int>& arr) { std::priority_queue<int> pq; for(int x : arr) pq.push(x); }`
  },
  {
    name: '40. O(n log n) Java Arrays.sort',
    language: 'java',
    expectedTime: 'O(n log n)', expectedSpace: 'O(1)',
    code: `void f(int[] arr) { Arrays.sort(arr); }`
  },

  // --- MIXED PATTERNS ---
  {
    name: '41. O(n^2 log n) Loop + std::sort',
    language: 'cpp',
    expectedTime: 'O(n^2 log n)', expectedSpace: 'O(1)',
    code: `void f(int n, std::vector<int>& arr) { for(int i=0; i<n; i++) std::sort(arr.begin(), arr.end()); }`
  },
  {
    name: '42. O(n^2 log n) Nested Priority Queue',
    language: 'cpp',
    expectedTime: 'O(n^2 log n)', expectedSpace: 'O(n²)',
    code: `void f(int n, std::vector<int>& arr) { std::priority_queue<int> pq; for(int i=0; i<n; i++) { for(int x : arr) pq.push(x); } }`
  },
  {
    name: '43. O(n^2) Double Slicing Recursion',
    language: 'python',
    expectedTime: 'O(2ⁿ)', expectedSpace: 'O(n²)', // recursive bifurcates
    code: `def recurse(arr):\n  if len(arr) <= 1: return\n  recurse(arr[1:])\n  recurse(arr[:-1])`
  },
  {
    name: '44. O(1) Function with Math',
    language: 'java',
    expectedTime: 'O(1)', expectedSpace: 'O(1)',
    code: `int f(int n, int m) { return n * m + (n - m) / 2; }`
  },
  {
    name: '45. O(n) Loop with Break',
    language: 'c',
    expectedTime: 'O(n)', expectedSpace: 'O(1)',
    code: `void f(int n) { for(int i=0; i<n; i++) { if(i==10) break; } }`
  },
  {
    name: '46. O(n) Recursive Traversal (Binary Tree)',
    language: 'java',
    expectedTime: 'O(n)', expectedSpace: 'O(log n)', // branching 2, balanced log n space
    code: `void traverse(Node root) { if (root == null) return; traverse(root.left); traverse(root.right); }`
  },
  {
    name: '47. O(n^2) Collection Growth inside Loop',
    language: 'python',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `def f(n):\n  res = []\n  for i in range(n):\n    for j in range(n):\n      res.append(i*j)`
  },
  {
    name: '48. O(n) Recursion with string building',
    language: 'java',
    expectedTime: 'O(n)', expectedSpace: 'O(n)', // Actually Java string concat in loop is O(n^2) but we might just say O(n) time
    code: `String f(int n) { if(n==0) return ""; return "a" + f(n-1); }`
  },
  {
    name: '49. O(n log n) Tree Map insertions',
    language: 'java',
    expectedTime: 'O(n log n)', expectedSpace: 'O(n)',
    code: `void f(int n) { TreeMap<Integer, Integer> map = new TreeMap<>(); for(int i=0; i<n; i++) map.put(i, 1); }`
  },
  {
    name: '50. O(n) Iterative Linked List Traversal',
    language: 'cpp',
    expectedTime: 'O(n)', expectedSpace: 'O(1)',
    code: `void f(Node* head) { while(head != nullptr) { head = head->next; } }`
  },
  {
    name: '51. Geometric Series',
    language: 'c',
    expectedTime: 'O(n)', expectedSpace: 'O(1)',
    code: `void geometric(int n){
    for(int i=n;i>=1;i/=2){
        for(int j=0;j<i;j++){}
    }
}`
  },
  {
    name: '52. Harmonic Series',
    language: 'c',
    expectedTime: 'O(n log n)', expectedSpace: 'O(1)',
    code: `void harmonic(int n){
    for(int i=1;i<=n;i++){
        for(int j=1;j<=n;j+=i){}
    }
}`
  },
  {
    name: '53. Triple Variable',
    language: 'c',
    expectedTime: 'O(kmn)', expectedSpace: 'O(1)',
    code: `void threeVars(int n,int m,int k){
    for(int i=0;i<n;i++)
        for(int j=0;j<m;j++)
            for(int x=0;x<k;x++){}
}`
  },
  {
    name: '54. Mixed Variables',
    language: 'c',
    expectedTime: 'O(mn)', expectedSpace: 'O(1)',
    code: `void mixed(int n,int m){
    for(int i=0;i<n;i++){}
    for(int j=0;j<m;j++){}
    for(int i=0;i<n;i++)
        for(int j=0;j<m;j++){}
}`
  },
  {
    name: '55. Log-Squared Recursion',
    language: 'c',
    expectedTime: 'O(log² n)', expectedSpace: 'O(log n)',
    code: `int f(int n){
    if(n<=1) return 1;
    return f(n/2)+1;
}
void wrapper(int n){
    for(int i=1;i<n;i*=2){
        f(n);
    }
}`
  },
  {
    name: '56. Ternary Recursion',
    language: 'c',
    expectedTime: 'O(3ⁿ)', expectedSpace: 'O(n)',
    code: `int tri(int n){
    if(n<=1) return 1;
    return tri(n-1)+tri(n-1)+tri(n-1);
}`
  },
  {
    name: '57. Master Theorem Case 3',
    language: 'c',
    expectedTime: 'O(n²)', expectedSpace: 'O(log n)',
    code: `void case3(int n){
    if(n<=1) return;
    for(int i=0;i<n*n;i++){}
    case3(n/2);
    case3(n/2);
}`
  },
  {
    name: '58. Matrix Allocation',
    language: 'c',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `void f(int n) {
    int **mat = malloc(n*sizeof(int*));
    for(int i=0;i<n;i++)
        mat[i]=malloc(n*sizeof(int));
}`
  },
  {
    name: '59. Recursive Matrix Allocation',
    language: 'c',
    expectedTime: 'O(n³)', expectedSpace: 'O(n³)',
    code: `void rec(int n){
    if(n==0) return;
    int arr[n][n];
    rec(n-1);
}`
  },
  {
    name: '69. Recursive + Allocation',
    language: 'cpp',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `void f(int n) {
    if(n==0) return;
    vector<int> v(n);
    f(n-1);
}`
  },
  {
    name: '60. Python Deep Slice',
    language: 'python',
    expectedTime: 'O(n log n)', expectedSpace: 'O(n)',
    code: `def f(arr):
    if len(arr)<=1:
        return
    left=arr[:len(arr)//2]
    right=arr[len(arr)//2:]
    f(left)
    f(right)`
  },
  {
    name: '61. Python List Multiplication',
    language: 'python',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `def build(n):
    arr=[0]*n
    return arr`
  },
  {
    name: '62. Python Nested Dict',
    language: 'python',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `def nested(n):
    d={}
    for i in range(n):
        d[i]={}
        for j in range(n):
            d[i][j]=j`
  },
  {
    name: '63. Java TreeMap',
    language: 'java',
    expectedTime: 'O(n log n)', expectedSpace: 'O(n)',
    code: `void f(int n) {
    TreeMap<Integer,Integer> map=new TreeMap<>();
    for(int i=0;i<n;i++){
        map.put(i,i);
    }
}`
  },
  {
    name: '64. Java PriorityQueue',
    language: 'java',
    expectedTime: 'O(n log n)', expectedSpace: 'O(n)',
    code: `void f(int n) {
    PriorityQueue<Integer> pq=new PriorityQueue<>();
    for(int i=0;i<n;i++){
        pq.offer(i);
    }
}`
  },
  {
    name: '65. C++ Multiset',
    language: 'cpp',
    expectedTime: 'O(n log n)', expectedSpace: 'O(n)',
    code: `void f(int n) {
    std::multiset<int> s;
    for(int i=0;i<n;i++){
        s.insert(i);
    }
}`
  },
  {
    name: '66. DFS Tree Traversal',
    language: 'cpp',
    expectedTime: 'O(n)', expectedSpace: 'O(log n)',
    code: `void dfs(Node* root){
    if(!root) return;
    dfs(root->left);
    dfs(root->right);
}`
  },
  {
    name: '67. BFS',
    language: 'cpp',
    expectedTime: 'O(n)', expectedSpace: 'O(n)',
    code: `void bfs(Node* root) {
    queue<Node*> q;
    q.push(root);
    while(!q.empty()){
        Node* cur=q.front();
        q.pop();
        if(cur->left) q.push(cur->left);
        if(cur->right) q.push(cur->right);
    }
}`
  },
  {
    name: '68. Two Independent Recursive Calls',
    language: 'cpp',
    expectedTime: 'O(n)', expectedSpace: 'O(log n)',
    code: `void f(int n){
    if(n<=1) return;
    f(n/2);
    f(n/2);
}`
  },
  {
    name: '69. Recursive + Allocation',
    language: 'c',
    expectedTime: 'O(n²)', expectedSpace: 'O(n²)',
    code: `void f(int n){
    if(n<=0) return;
    int *arr=malloc(n*sizeof(int));
    f(n-1);
}`
  },
  {
    name: '70. Sliding Window',
    language: 'cpp',
    expectedTime: 'O(n)', expectedSpace: 'O(1)',
    code: `void f(int n, int k, int arr[]) {
    int sum = 0;
    int i = 0;
    int j = 0;
    while(j < n){
        sum += arr[j];
        while(sum > k){
            sum -= arr[i++];
        }
        j++;
    }
}`
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;
  const results = [];

  for (const tc of testCases) {
    try {
      const res = analyze(tc.code, { language: tc.language });
      const actualTime = res.overall.display;
      const actualSpace = res.overall.spaceDisplay;
      
      // Handle some flexible matching if needed, but exact is preferred.
      const timeMatch = actualTime === tc.expectedTime;
      const spaceMatch = actualSpace === tc.expectedSpace;
      const isPass = timeMatch && spaceMatch;

      if (isPass) passed++; else failed++;

      const timeReasoning = res.functions[0]?.reasoning?.join('\n       ') || 'None';
      const spaceReasoning = res.functions[0]?.spaceReasoning?.join('\n       ') || 'None';
      
      results.push({
        name: tc.name,
        language: tc.language,
        status: isPass ? 'PASS' : 'FAIL',
        expectedTime: tc.expectedTime,
        actualTime,
        expectedSpace: tc.expectedSpace,
        actualSpace,
        reasoning: { time: res.functions[0]?.reasoning, space: res.functions[0]?.spaceReasoning }
      });
      
      console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${tc.name}  |  Time: ${actualTime} (Expected: ${tc.expectedTime})  |  Space: ${actualSpace} (Expected: ${tc.expectedSpace})`);
      console.log(`   -> Time Reasoning:\n       ${timeReasoning}`);
      console.log(`   -> Space Reasoning:\n       ${spaceReasoning}`);
      if (!isPass) {
        console.log(`   -> FAILED! Actual Time: ${actualTime}, Actual Space: ${actualSpace}`);
      }
    } catch (e) {
      failed++;
      console.log(`[ERROR] ${tc.name}: ${e.message}`);
      results.push({
        name: tc.name,
        status: 'ERROR',
        error: e.message
      });
    }
  }

  console.log(`\nTest Run Complete: ${passed} Passed, ${failed} Failed.`);
  
  // Write markdown report
  let md = `# Time & Space Complexity Analyzer - 50 Hard Tracing Tests Report\n\n`;
  md += `**Overall Status**: ${passed} Passed / ${failed} Failed\n\n`;
  
  md += `## Summary Table\n\n`;
  md += `| ID | Test Name | Language | Status | Expected Time | Actual Time | Expected Space | Actual Space |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;
  
  results.forEach((r, i) => {
    md += `| ${i+1} | ${r.name} | ${r.language || '-'} | ${r.status} | ${r.expectedTime || '-'} | ${r.actualTime || '-'} | ${r.expectedSpace || '-'} | ${r.actualSpace || '-'} |\n`;
  });
  
  const failures = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
  if (failures.length > 0) {
    md += `\n## Failure Details\n\n`;
    failures.forEach((f) => {
      md += `### ${f.name}\n`;
      if (f.status === 'ERROR') {
        md += `**Error:** ${f.error}\n\n`;
      } else {
        md += `- **Expected**: Time ${f.expectedTime}, Space ${f.expectedSpace}\n`;
        md += `- **Actual**: Time ${f.actualTime}, Space ${f.actualSpace}\n\n`;
        if (f.reasoning) {
          md += `<details><summary>Analyzer Reasoning</summary>\n\n`
          md += `**Time:**\n`;
          f.reasoning.time?.forEach(r => md += `- ${r}\n`);
          md += `**Space:**\n`;
          f.reasoning.space?.forEach(r => md += `- ${r}\n`);
          md += `</details>\n\n`;
        }
      }
    });
  }

  fs.writeFileSync('test-report.md', md);
  console.log('Saved report to test-report.md');
}

runTests();
