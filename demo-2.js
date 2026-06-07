/**
 * Demo 2 script - run with: node demo-2.js
 */

import { analyze } from './src/index.js';

function printResult(title, code, language) {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ${title}`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const result = analyze(code, { language });

    for (const func of result.functions) {
      if (func.name === 'main') continue; // Skip main if present
      
      console.log(`  ${func.name}(${func.params.join(', ')})`);
      console.log(`    Time:       ${func.display}`);
      console.log(`    Space:      ${func.spaceDisplay}`);
      console.log(`    Confidence: ${func.confidence.score} (${func.confidence.level})`);
      console.log(`    Loop depth: ${func.loopDepth}`);
      console.log(`    Recursive:  ${func.isRecursive}`);
      
      // Add patterns output
      const patternResult = result.analyzerResults.find(
        a => a.analyzerName === 'pattern-detector'
      );
      if (patternResult) {
        const funcPatterns = patternResult.functionResults.find(
          r => r.functionName === func.name
        );
        if (funcPatterns && funcPatterns.patterns.length > 0) {
          console.log('    Algorithm Patterns:');
          for (const p of funcPatterns.patterns) {
            console.log(`      [${p.confidence}] ${p.pattern}`);
          }
        }
      }
      
      if (func.reasoning.length > 0) {
        console.log('    Time reasoning:');
        for (const r of func.reasoning) {
          console.log(`      ${r}`);
        }
      }
      if (func.spaceReasoning && func.spaceReasoning.length > 0) {
        console.log('    Space reasoning:');
        for (const r of func.spaceReasoning) {
          console.log(`      ${r}`);
        }
      }
    }
  } catch(e) {
    console.log("  Error: " + e.message);
  }
  console.log();
}

// C
printResult('C: O(n/2) → O(n)', `
void halfLoop(int n){
    for(int i=0;i<n/2;i++){
        printf("%d ",i);
    }
}
`, 'c');

printResult('C: O(n+m)', `
void twoArrays(int n,int m){
    for(int i=0;i<n;i++){}
    for(int j=0;j<m;j++){}
}
`, 'c');

printResult('C: O(n*m)', `
void matrix(int n,int m){
    for(int i=0;i<n;i++){
        for(int j=0;j<m;j++){}
    }
}
`, 'c');

printResult('C: O(log log n)', `
void loglog(int n){
    for(int i=2;i<n;i=i*i){}
}
`, 'c');

printResult('C: O(n√n)', `
void nestedRoot(int n){
    for(int i=0;i<n;i++){
        for(int j=1;j*j<n;j++){}
    }
}
`, 'c');

// C++
printResult('C++: STL sort', `
#include <vector>
#include <algorithm>
using namespace std;
void sortTest(vector<int>& a){
    sort(a.begin(),a.end());
}
`, 'cpp');

printResult('C++: unordered_set', `
#include <vector>
#include <unordered_set>
using namespace std;
void unique(vector<int>& a){
    unordered_set<int> s;
    for(int x:a){
        s.insert(x);
    }
}
`, 'cpp');

printResult('C++: Priority Queue', `
#include <vector>
#include <queue>
using namespace std;
void heap(vector<int>& a){
    priority_queue<int> pq;

    for(int x:a){
        pq.push(x);
    }
}
`, 'cpp');

// Java
printResult('Java: ArrayList Growth', `
import java.util.ArrayList;
class Test {
  void addElements(int n){
      ArrayList<Integer> arr=new ArrayList<>();

      for(int i=0;i<n;i++){
          arr.add(i);
      }
  }
}
`, 'java');

printResult('Java: HashMap', `
import java.util.HashMap;
class Test {
  void mapTest(int n){
      HashMap<Integer,Integer> map=new HashMap<>();

      for(int i=0;i<n;i++){
          map.put(i,i);
      }
  }
}
`, 'java');

printResult('Java: Binary Search', `
class Test {
  int search(int[] a,int l,int r,int x){
      if(l>r) return -1;

      int mid=(l+r)/2;

      if(a[mid]==x) return mid;

      if(x<a[mid])
          return search(a,l,mid-1,x);

      return search(a,mid+1,r,x);
  }
}
`, 'java');

// Python
printResult('Python: List Comprehension', `
def squares(n):
    arr=[i*i for i in range(n)]
    return arr
`, 'python');

printResult('Python: Nested Comprehension', `
def matrix(n):
    arr=[[0 for j in range(n)] for i in range(n)]
    return arr
`, 'python');

printResult('Python: Dictionary', `
def freq(arr):
    d={}
    for x in arr:
        d[x]=d.get(x,0)+1
`, 'python');

printResult('Python: Slicing Trap', `
def recurse(arr):
    if len(arr)<=1:
        return

    recurse(arr[1:])
`, 'python');

printResult('Python: Merge Sort (Python)', `
def merge_sort(arr):
    if len(arr)<=1:
        return arr

    mid=len(arr)//2

    left=merge_sort(arr[:mid])
    right=merge_sort(arr[mid:])

    return merge(left,right)

def merge(left, right):
    return left + right
`, 'python');
