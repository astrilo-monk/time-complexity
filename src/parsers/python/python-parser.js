/**
 * Python Parser Adapter
 *
 * Converts tree-sitter Python CST into the common IR.
 * Handles function definitions, for/while loops, branches,
 * calls, assignments, and Python-specific constructs like
 * range() loops and list comprehensions.
 */

import PythonGrammar from 'tree-sitter-python';
import {
  BaseParser,
  ProgramNode,
  FunctionNode,
  LoopNode,
  BlockNode,
  BranchNode,
  CallNode,
  VariableNode,
  AllocationNode,
  ReturnNode,
  BreakNode,
  ContinueNode,
  ExpressionNode,
} from '../base-parser.js';

export class PythonParser extends BaseParser {
  constructor() {
    super(PythonGrammar, 'python');
  }

  /**
   * Build IR from tree-sitter Python CST root.
   * @param {object} rootNode - tree-sitter root node
   * @param {string} sourceCode
   * @returns {ProgramNode}
   */
  buildIR(rootNode, sourceCode) {
    const program = new ProgramNode('python', this.loc(rootNode));

    for (const child of this.getNamedChildren(rootNode)) {
      const node = this.processNode(child);
      if (node) {
        if (node.type === 'function') {
          program.addFunction(node);
        } else {
          program.addChild(node);
        }
      }
    }

    return program;
  }

  /**
   * Process a single CST node and return the corresponding IR node.
   * @param {object} tsNode - tree-sitter node
   * @returns {IRNode|null}
   */
  processNode(tsNode) {
    if (!tsNode) return null;

    switch (tsNode.type) {
      case 'function_definition':
        return this.processFunction(tsNode);
      case 'for_statement':
        return this.processForLoop(tsNode);
      case 'while_statement':
        return this.processWhileLoop(tsNode);
      case 'if_statement':
        return this.processIfStatement(tsNode);
      case 'return_statement':
        return this.processReturn(tsNode);
      case 'break_statement':
        return new BreakNode(this.loc(tsNode));
      case 'continue_statement':
        return new ContinueNode(this.loc(tsNode));
      case 'expression_statement':
        return this.processExpressionStatement(tsNode);
      case 'assignment':
        return this.processAssignment(tsNode);
      case 'augmented_assignment':
        return this.processAugmentedAssignment(tsNode);
      case 'call':
        return this.processCall(tsNode);
      case 'class_definition':
        return this.processClass(tsNode);
      case 'list':
      case 'dictionary':
      case 'set':
        return this.processCollectionLiteral(tsNode);
      case 'list_comprehension':
      case 'dictionary_comprehension':
      case 'set_comprehension':
        return this.processComprehension(tsNode);
      case 'decorated_definition':
        return this.processDecoratedDefinition(tsNode);
      default:
        return null;
    }
  }

  /**
   * Process a function definition.
   * @param {object} tsNode
   * @returns {FunctionNode}
   */
  processFunction(tsNode) {
    const nameNode = this.getField(tsNode, 'name');
    const name = nameNode ? this.getNodeText(nameNode) : '<anonymous>';

    const paramsNode = this.getField(tsNode, 'parameters');
    const params = this.extractParams(paramsNode);

    const func = new FunctionNode(name, params, this.loc(tsNode));

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      const block = this.processBlock(bodyNode);
      func.setBody(block);
    }

    return func;
  }

  /**
   * Extract parameter names from a parameters node.
   * @param {object} paramsNode
   * @returns {string[]}
   */
  extractParams(paramsNode) {
    if (!paramsNode) return [];
    const params = [];

    for (const child of this.getNamedChildren(paramsNode)) {
      if (child.type === 'identifier') {
        params.push(this.getNodeText(child));
      } else if (child.type === 'default_parameter') {
        const nameNode = this.getField(child, 'name');
        if (nameNode) params.push(this.getNodeText(nameNode));
      } else if (child.type === 'typed_parameter') {
        const nameChild = child.namedChildren[0];
        if (nameChild) params.push(this.getNodeText(nameChild));
      } else if (child.type === 'typed_default_parameter') {
        const nameNode = this.getField(child, 'name');
        if (nameNode) params.push(this.getNodeText(nameNode));
      } else if (child.type === 'list_splat_pattern' || child.type === 'dictionary_splat_pattern') {
        const text = this.getNodeText(child);
        params.push(text);
      }
    }

    // Filter out 'self' for methods
    return params.filter(p => p !== 'self');
  }

  /**
   * Process a block (suite) of statements.
   * In Python, the body of a function/loop/if is a 'block' node.
   * @param {object} tsNode
   * @returns {BlockNode}
   */
  processBlock(tsNode) {
    const block = new BlockNode(this.loc(tsNode));

    // A block node's children are the statements
    for (const child of this.getNamedChildren(tsNode)) {
      const node = this.processNode(child);
      if (node) {
        block.addStatement(node);
      }
    }

    return block;
  }

  /**
   * Process a for loop.
   * Python for loops are for-each by default, but range() makes them
   * equivalent to counted loops.
   * @param {object} tsNode
   * @returns {LoopNode}
   */
  processForLoop(tsNode) {
    const leftNode = this.getField(tsNode, 'left');
    const rightNode = this.getField(tsNode, 'right');
    const bodyNode = this.getField(tsNode, 'body');

    const iteratorVar = leftNode ? this.getNodeText(leftNode) : null;

    // Check if iterating over range()
    const rangeInfo = this.analyzeRangeCall(rightNode);

    let loop;
    if (rangeInfo) {
      // range() makes this a counted loop - treat as 'for'
      loop = new LoopNode('for', this.loc(tsNode));
      loop.iteratorVar = iteratorVar;
      loop.boundVar = rangeInfo.bound;
      loop.initValue = rangeInfo.start;
      loop.incrementType = 'additive';
      loop.incrementValue = rangeInfo.step;
      loop.condition = `${iteratorVar} < ${rangeInfo.bound}`;
    } else {
      // Generic for-each loop
      loop = new LoopNode('for-each', this.loc(tsNode));
      loop.iteratorVar = iteratorVar;
      if (rightNode) {
        loop.condition = this.getNodeText(rightNode);
      }
    }

    if (bodyNode) {
      loop.setBody(this.processBlock(bodyNode));
    }

    return loop;
  }

  /**
   * Analyze a range() call to extract loop bounds.
   *
   * Patterns:
   *   range(n)          → start=0, bound='n', step=1
   *   range(start, n)   → start='start', bound='n', step=1
   *   range(start,n,s)  → start='start', bound='n', step='s'
   *
   * @param {object} tsNode - the right-hand side of the for loop
   * @returns {{ start: *, bound: string, step: * }|null}
   */
  analyzeRangeCall(tsNode) {
    if (!tsNode || tsNode.type !== 'call') return null;

    const funcNode = this.getField(tsNode, 'function');
    if (!funcNode || this.getNodeText(funcNode) !== 'range') return null;

    const argsNode = this.getField(tsNode, 'arguments');
    if (!argsNode) return null;

    const args = this.getNamedChildren(argsNode);

    if (args.length === 1) {
      return {
        start: 0,
        bound: this.getNodeText(args[0]),
        step: 1,
      };
    } else if (args.length === 2) {
      const startVal = this.extractNumericValue(args[0]);
      return {
        start: startVal !== null ? startVal : this.getNodeText(args[0]),
        bound: this.getNodeText(args[1]),
        step: 1,
      };
    } else if (args.length >= 3) {
      const startVal = this.extractNumericValue(args[0]);
      const stepVal = this.extractNumericValue(args[2]);
      return {
        start: startVal !== null ? startVal : this.getNodeText(args[0]),
        bound: this.getNodeText(args[1]),
        step: stepVal !== null ? stepVal : this.getNodeText(args[2]),
      };
    }

    return null;
  }

  /**
   * Process a while loop.
   * @param {object} tsNode
   * @returns {LoopNode}
   */
  processWhileLoop(tsNode) {
    const condNode = this.getField(tsNode, 'condition');
    const bodyNode = this.getField(tsNode, 'body');

    const loop = new LoopNode('while', this.loc(tsNode));

    if (condNode) {
      loop.condition = this.getNodeText(condNode);
    }

    if (bodyNode) {
      loop.setBody(this.processBlock(bodyNode));
    }

    return loop;
  }

  /**
   * Process an if statement with elif/else chains.
   * @param {object} tsNode
   * @returns {BranchNode}
   */
  processIfStatement(tsNode) {
    const branch = new BranchNode(this.loc(tsNode));

    const condNode = this.getField(tsNode, 'condition');
    if (condNode) {
      branch.condition = this.getNodeText(condNode);
    }

    const consequenceNode = this.getField(tsNode, 'consequence');
    if (consequenceNode) {
      branch.setConsequence(this.processBlock(consequenceNode));
    }

    const alternativeNode = this.getField(tsNode, 'alternative');
    if (alternativeNode) {
      if (alternativeNode.type === 'elif_clause') {
        // elif is essentially another if - create nested BranchNode
        const elifBranch = new BranchNode(this.loc(alternativeNode));
        const elifCond = this.getField(alternativeNode, 'condition');
        if (elifCond) elifBranch.condition = this.getNodeText(elifCond);
        const elifBody = this.getField(alternativeNode, 'consequence');
        if (elifBody) elifBranch.setConsequence(this.processBlock(elifBody));
        branch.setAlternative(elifBranch);
      } else if (alternativeNode.type === 'else_clause') {
        const elseBody = this.getField(alternativeNode, 'body');
        if (elseBody) {
          branch.setAlternative(this.processBlock(elseBody));
        }
      }
    }

    return branch;
  }

  /**
   * Process a return statement.
   * @param {object} tsNode
   * @returns {ReturnNode}
   */
  processReturn(tsNode) {
    const ret = new ReturnNode(this.loc(tsNode));
    const children = this.getNamedChildren(tsNode);
    if (children.length > 0) {
      ret.value = this.getNodeText(children[0]);
      // Walk the expression tree to extract embedded calls
      this.extractCallsFromExpression(children[0], ret);

      // Check if the returned value is an allocation or comprehension
      const returnedAlloc = this.checkForAllocation(children[0]);
      if (returnedAlloc) {
        ret.addChild(returnedAlloc);
      }

      // Heuristic: If returning a binary operator +, it might be list concatenation (O(n) time/space)
      if (children[0].type === 'binary_operator') {
        const operator = this.getField(children[0], 'operator');
        if (operator && this.getNodeText(operator) === '+') {
          const leftOperand = this.getNodeText(this.getField(children[0], 'left'));
          const rightOperand = this.getNodeText(this.getField(children[0], 'right'));
          // Check if operands look like collections
          if (/left|right|arr|list|nums|res/i.test(leftOperand) || /left|right|arr|list|nums|res/i.test(rightOperand)) {
            const alloc = new AllocationNode('array', this.loc(tsNode));
            alloc.sizeExpression = `${leftOperand}+${rightOperand}`;
            
            // Emit a loop to simulate the O(n) copy operations in time complexity
            const loop = new LoopNode('for-each', this.loc(tsNode));
            loop.iteratorVar = 'item';
            loop.iterableVar = `${leftOperand}+${rightOperand}`;
            
            // Make them siblings instead of nesting the allocation inside the loop!
            ret.addChild(alloc);
            ret.addChild(loop);
          }
        }
      }
    }
    return ret;
  }

  /**
   * Recursively walk a CST expression node to extract embedded function calls.
   * This is needed because calls can be nested inside binary expressions,
   * e.g., `n * factorial(n-1)` - the call to factorial must be captured.
   * @param {object} tsNode - tree-sitter expression node
   * @param {IRNode} parent - IR node to add extracted calls to
   */
  extractCallsFromExpression(tsNode, parent) {
    if (!tsNode) return;

    if (tsNode.type === 'call') {
      const callNode = this.processCall(tsNode);
      if (callNode) parent.addChild(callNode);
      return;
    }

    for (const child of this.getNamedChildren(tsNode)) {
      this.extractCallsFromExpression(child, parent);
    }
  }

  /**
   * Process an expression statement (a statement that is just an expression).
   * @param {object} tsNode
   * @returns {IRNode|null}
   */
  processExpressionStatement(tsNode) {
    const children = this.getNamedChildren(tsNode);
    if (children.length === 0) return null;

    const expr = children[0];

    // Delegate to specific processors
    if (expr.type === 'call') {
      return this.processCall(expr);
    }
    if (expr.type === 'assignment') {
      return this.processAssignment(expr);
    }
    if (expr.type === 'augmented_assignment') {
      return this.processAugmentedAssignment(expr);
    }

    return new ExpressionNode(this.getNodeText(expr), this.loc(expr));
  }

  /**
   * Process a function call.
   * @param {object} tsNode
   * @returns {CallNode|AllocationNode}
   */
  processCall(tsNode) {
    const funcNode = this.getField(tsNode, 'function');
    if (!funcNode) return new ExpressionNode(this.getNodeText(tsNode), this.loc(tsNode));

    const funcName = this.getNodeText(funcNode);

    // Check for collection constructors
    const collectionTypes = ['list', 'dict', 'set', 'frozenset', 'tuple', 'deque', 'defaultdict', 'OrderedDict', 'Counter'];
    for (const collType of collectionTypes) {
      if (funcName === collType || funcName.endsWith(`.${collType}`)) {
        const alloc = new AllocationNode('collection', this.loc(tsNode));
        alloc.dataStructure = collType;
        return alloc;
      }
    }

    const call = new CallNode(funcName, this.loc(tsNode));

    // Extract argument texts and inline allocations
    const argsNode = this.getField(tsNode, 'arguments');
    if (argsNode) {
      for (const arg of this.getNamedChildren(argsNode)) {
        call.arguments.push(this.getNodeText(arg));
        
        // Check for inline allocations like arr[1:] passed as argument
        const alloc = this.checkForAllocation(arg);
        if (alloc) {
          call.addChild(alloc);
        }
      }
    }

    return call;
  }

  /**
   * Process an assignment.
   * @param {object} tsNode
   * @returns {VariableNode|AllocationNode}
   */
  processAssignment(tsNode) {
    const leftNode = this.getField(tsNode, 'left');
    const rightNode = this.getField(tsNode, 'right');

    const name = leftNode ? this.getNodeText(leftNode) : '<unknown>';
    const rightText = rightNode ? this.getNodeText(rightNode) : null;

    // Check if the right side is a collection literal or constructor
    if (rightNode) {
      const allocNode = this.checkForAllocation(rightNode);
      if (allocNode) return allocNode;
    }

    // If it's a subscript assignment like d[x] = y, emit a CallNode to simulate collection accumulation
    if (leftNode && leftNode.type === 'subscript') {
      const objNode = this.getField(leftNode, 'value');
      const objName = objNode ? this.getNodeText(objNode) : 'dict';
      const callNode = new CallNode(`${objName}.put`, this.loc(tsNode));
      if (rightNode) this.extractCallsFromExpression(rightNode, callNode);
      return callNode;
    }

    const varNode = new VariableNode(name, 'assignment', this.loc(tsNode));
    varNode.initialValue = rightText;
    
    // Extract calls from the right side so recursive calls in assignments are detected
    if (rightNode) {
      this.extractCallsFromExpression(rightNode, varNode);
    }

    return varNode;
  }

  /**
   * Process augmented assignment (+=, -=, *=, etc.)
   * @param {object} tsNode
   * @returns {VariableNode}
   */
  processAugmentedAssignment(tsNode) {
    const leftNode = this.getField(tsNode, 'left');
    const name = leftNode ? this.getNodeText(leftNode) : '<unknown>';
    const varNode = new VariableNode(name, 'assignment', this.loc(tsNode));
    varNode.initialValue = this.getNodeText(tsNode);
    return varNode;
  }

  /**
   * Check if a CST node represents a memory allocation.
   * @param {object} tsNode
   * @returns {AllocationNode|null}
   */
  checkForAllocation(tsNode) {
    if (!tsNode) return null;

    // List, dict, set literals
    if (tsNode.type === 'list' || tsNode.type === 'dictionary' || tsNode.type === 'set') {
      const alloc = new AllocationNode('collection', this.loc(tsNode));
      alloc.dataStructure = tsNode.type === 'dictionary' ? 'dict' : tsNode.type;
      return alloc;
    }

    // List/dict/set comprehensions - handled by processComprehension which returns a loop
    if (tsNode.type === 'list_comprehension' || tsNode.type === 'dictionary_comprehension' || tsNode.type === 'set_comprehension') {
      return this.processComprehension(tsNode);
    }

    // Constructor calls like list(), dict(), set()
    if (tsNode.type === 'call') {
      const funcNode = this.getField(tsNode, 'function');
      if (funcNode) {
        const funcName = this.getNodeText(funcNode);
        const collTypes = ['list', 'dict', 'set', 'frozenset', 'tuple', 'deque', 'defaultdict'];
        if (collTypes.includes(funcName)) {
          const alloc = new AllocationNode('collection', this.loc(tsNode));
          alloc.dataStructure = funcName;
          return alloc;
        }
      }
    }

    // Multiplication pattern for array-like: [0] * n
    if (tsNode.type === 'binary_operator') {
      const text = this.getNodeText(tsNode);
      if (text.includes('*') && (text.includes('[') || text.includes('None'))) {
        const alloc = new AllocationNode('array', this.loc(tsNode));
        alloc.dataStructure = 'list';
        alloc.sizeExpression = text;
        return alloc;
      }
    }

    // Slicing allocation
    if (tsNode.type === 'subscript') {
      const text = this.getNodeText(tsNode);
      if (text.includes(':')) {
        const alloc = new AllocationNode('array', this.loc(tsNode));
        alloc.dataStructure = 'list';
        alloc.sizeExpression = 'n'; // Slicing generally creates an O(n) array copy
        return alloc;
      }
    }

    return null;
  }

  /**
   * Process a collection literal (list, dict, set).
   * @param {object} tsNode
   * @returns {AllocationNode}
   */
  processCollectionLiteral(tsNode) {
    const alloc = new AllocationNode('collection', this.loc(tsNode));
    alloc.dataStructure = tsNode.type === 'dictionary' ? 'dict' : tsNode.type;
    return alloc;
  }

  /**
   * Process a comprehension (list/dict/set comprehension).
   * @param {object} tsNode
   * @returns {LoopNode}
   */
  processComprehension(tsNode) {
    const alloc = new AllocationNode('collection', this.loc(tsNode));
    alloc.dataStructure = tsNode.type.replace('_comprehension', '');
    if (alloc.dataStructure === 'dictionary') alloc.dataStructure = 'dict';

    const forClauses = this.getNamedChildren(tsNode).filter(c => c.type === 'for_in_clause');
    
    if (forClauses.length === 0) {
      const loop = new LoopNode('for-each', this.loc(tsNode));
      loop.iteratorVar = 'comprehension_item';
      const block = new BlockNode(this.loc(tsNode));
      block.addStatement(alloc);
      loop.setBody(block);
      return loop;
    }

    let rootLoop = null;
    let currentLoop = null;

    for (const forClause of forClauses) {
      const loop = new LoopNode('for-each', this.loc(forClause));
      const left = this.getField(forClause, 'left');
      const right = this.getField(forClause, 'right');
      loop.iteratorVar = left ? this.getNodeText(left) : 'item';
      loop.iterableVar = right ? this.getNodeText(right) : 'collection';
      
      const block = new BlockNode(this.loc(forClause));
      loop.setBody(block);

      if (!rootLoop) {
        rootLoop = loop;
        currentLoop = loop;
      } else {
        currentLoop.body.addStatement(loop);
        currentLoop = loop;
      }
    }

    currentLoop.body.addStatement(alloc);
    
    // Process the body of the comprehension to capture nested comprehensions
    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      this.extractCallsFromExpression(bodyNode, currentLoop.body);
      const innerLoop = this.checkForAllocation(bodyNode);
      if (innerLoop && innerLoop.type === 'loop') {
        currentLoop.body.addStatement(innerLoop);
      }
    }

    return rootLoop;
  }

  /**
   * Process a class definition - extract methods as functions.
   * @param {object} tsNode
   * @returns {IRNode|null}
   */
  processClass(tsNode) {
    const bodyNode = this.getField(tsNode, 'body');
    if (!bodyNode) return null;

    const className = this.getField(tsNode, 'name');
    const classNameText = className ? this.getNodeText(className) : '<anonymous>';

    // Process methods within the class
    const block = new BlockNode(this.loc(tsNode));
    block.metadata.className = classNameText;

    for (const child of this.getNamedChildren(bodyNode)) {
      if (child.type === 'function_definition') {
        const func = this.processFunction(child);
        if (func) {
          func.metadata.className = classNameText;
          block.addStatement(func);
        }
      } else if (child.type === 'decorated_definition') {
        const inner = this.processDecoratedDefinition(child);
        if (inner) block.addStatement(inner);
      }
    }

    return block;
  }

  /**
   * Process a decorated definition (e.g., @staticmethod).
   * @param {object} tsNode
   * @returns {IRNode|null}
   */
  processDecoratedDefinition(tsNode) {
    const defNode = this.getField(tsNode, 'definition');
    if (defNode) {
      return this.processNode(defNode);
    }
    return null;
  }
}
