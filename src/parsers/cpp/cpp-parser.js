/**
 * C++ Parser Adapter
 *
 * Converts tree-sitter C++ CST into the common IR.
 * Extends the C parser patterns and adds C++-specific constructs:
 * range-based for loops, new/delete, STL container detection,
 * and method calls.
 */

import CppLanguage from 'tree-sitter-cpp';
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

/** STL container types that imply heap allocation — sorted longest-first to prevent substring false matches */
const STL_CONTAINERS = [
  'unordered_multimap', 'unordered_multiset',
  'unordered_map', 'unordered_set',
  'priority_queue', 'forward_list',
  'basic_string',
  'multimap', 'multiset',
  'vector', 'deque', 'list',
  'map', 'set',
  'queue', 'stack',
  'array', 'string',
];

export class CppParser extends BaseParser {
  constructor() {
    super(CppLanguage, 'cpp');
  }

  /**
   * Build IR from tree-sitter C++ CST root.
   * @param {object} rootNode
   * @param {string} sourceCode
   * @returns {ProgramNode}
   */
  buildIR(rootNode, sourceCode) {
    const program = new ProgramNode('cpp', this.loc(rootNode));

    for (const child of this.getNamedChildren(rootNode)) {
      const results = this.processTopLevel(child);
      for (const node of results) {
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
   * Process a top-level CST node. Classes may yield multiple functions.
   * @param {object} tsNode
   * @returns {IRNode[]}
   */
  processTopLevel(tsNode) {
    if (!tsNode) return [];

    if (tsNode.type === 'class_specifier' || tsNode.type === 'struct_specifier') {
      return this.processClassDef(tsNode);
    }

    const node = this.processNode(tsNode);
    return node ? [node] : [];
  }

  /**
   * Process a single CST node into the corresponding IR node.
   * @param {object} tsNode
   * @returns {IRNode|null}
   */
  processNode(tsNode) {
    if (!tsNode) return null;

    switch (tsNode.type) {
      case 'function_definition':
        return this.processFunction(tsNode);
      case 'for_statement':
        return this.processForLoop(tsNode);
      case 'for_range_loop':
        return this.processRangeForLoop(tsNode);
      case 'while_statement':
        return this.processWhileLoop(tsNode);
      case 'do_statement':
        return this.processDoWhileLoop(tsNode);
      case 'if_statement':
        return this.processIfStatement(tsNode);
      case 'return_statement':
        return this.processReturn(tsNode);
      case 'break_statement':
        return new BreakNode(this.loc(tsNode));
      case 'continue_statement':
        return new ContinueNode(this.loc(tsNode));
      case 'compound_statement':
        return this.processCompoundStatement(tsNode);
      case 'declaration':
        return this.processDeclaration(tsNode);
      case 'expression_statement':
        return this.processExpressionStatement(tsNode);
      case 'new_expression':
        return this.processNewExpression(tsNode);
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
    const declaratorNode = this.getField(tsNode, 'declarator');
    const name = this.extractFunctionName(declaratorNode);
    const params = this.extractFunctionParams(declaratorNode);

    const typeNode = this.getField(tsNode, 'type');
    const returnType = typeNode ? this.getNodeText(typeNode) : null;

    const func = new FunctionNode(name, params, this.loc(tsNode));
    func.returnType = returnType;

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      func.setBody(this.processCompoundStatement(bodyNode));
    }

    return func;
  }

  /**
   * Extract function name, handling nested/qualified declarators.
   * @param {object} declaratorNode
   * @returns {string}
   */
  extractFunctionName(declaratorNode) {
    if (!declaratorNode) return '<anonymous>';

    if (declaratorNode.type === 'function_declarator') {
      const nameNode = this.getField(declaratorNode, 'declarator');
      if (!nameNode) return '<anonymous>';
      // Handle qualified names like ClassName::method
      if (nameNode.type === 'qualified_identifier' || nameNode.type === 'scoped_identifier') {
        return this.getNodeText(nameNode);
      }
      return this.getNodeText(nameNode);
    }

    if (declaratorNode.type === 'pointer_declarator' || declaratorNode.type === 'reference_declarator') {
      const inner = this.getField(declaratorNode, 'declarator');
      return this.extractFunctionName(inner);
    }

    return this.getNodeText(declaratorNode);
  }

  /**
   * Extract parameter names from a function declarator.
   * @param {object} declaratorNode
   * @returns {string[]}
   */
  extractFunctionParams(declaratorNode) {
    if (!declaratorNode) return [];

    let funcDecl = declaratorNode;
    while (funcDecl && funcDecl.type !== 'function_declarator') {
      funcDecl = this.getField(funcDecl, 'declarator');
    }
    if (!funcDecl) return [];

    const paramsNode = this.getField(funcDecl, 'parameters');
    if (!paramsNode) return [];

    const params = [];
    for (const child of this.getNamedChildren(paramsNode)) {
      if (child.type === 'parameter_declaration' || child.type === 'optional_parameter_declaration') {
        const declNode = this.getField(child, 'declarator');
        if (declNode) {
          let nameNode = declNode;
          while (nameNode.type === 'pointer_declarator' || nameNode.type === 'reference_declarator') {
            nameNode = this.getField(nameNode, 'declarator') || nameNode;
            break;
          }
          params.push(this.getNodeText(nameNode));
        }
      }
    }

    return params;
  }

  /**
   * Process a class/struct definition — extract method definitions.
   * @param {object} tsNode
   * @returns {FunctionNode[]}
   */
  processClassDef(tsNode) {
    const nameNode = this.getField(tsNode, 'name');
    const className = nameNode ? this.getNodeText(nameNode) : '<anonymous>';

    const bodyNode = this.getField(tsNode, 'body');
    if (!bodyNode) return [];

    const functions = [];
    for (const child of this.getNamedChildren(bodyNode)) {
      if (child.type === 'function_definition') {
        const func = this.processFunction(child);
        if (func) {
          func.metadata.className = className;
          functions.push(func);
        }
      } else if (child.type === 'access_specifier') {
        // skip public/private/protected
        continue;
      } else if (child.type === 'declaration') {
        // Could be an inline method declaration — skip for now
        continue;
      }
    }

    return functions;
  }

  /**
   * Process a compound statement (brace-enclosed block).
   * @param {object} tsNode
   * @returns {BlockNode}
   */
  processCompoundStatement(tsNode) {
    const block = new BlockNode(this.loc(tsNode));
    for (const child of this.getNamedChildren(tsNode)) {
      const node = this.processNode(child);
      if (node) block.addStatement(node);
    }
    return block;
  }

  /**
   * Process a C-style for loop.
   * @param {object} tsNode
   * @returns {LoopNode}
   */
  processForLoop(tsNode) {
    const loop = new LoopNode('for', this.loc(tsNode));

    const initNode = this.getField(tsNode, 'initializer');
    const condNode = this.getField(tsNode, 'condition');
    const updateNode = this.getField(tsNode, 'update');

    if (initNode) loop.init = this.getNodeText(initNode);
    if (condNode) loop.condition = this.getNodeText(condNode);
    if (updateNode) loop.update = this.getNodeText(updateNode);

    const structure = this.analyzeForLoopStructure(initNode, condNode, updateNode);
    loop.iteratorVar = structure.iteratorVar;
    loop.boundVar = structure.boundVar;
    loop.initValue = structure.initValue;
    loop.incrementType = structure.incrementType;
    loop.incrementValue = structure.incrementValue;

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      loop.setBody(
        bodyNode.type === 'compound_statement'
          ? this.processCompoundStatement(bodyNode)
          : this.wrapInBlock(bodyNode)
      );
    }

    return loop;
  }

  /**
   * Process a C++11 range-based for loop: for(auto x : container)
   * @param {object} tsNode
   * @returns {LoopNode}
   */
  processRangeForLoop(tsNode) {
    const loop = new LoopNode('for-each', this.loc(tsNode));

    const declNode = this.getField(tsNode, 'declarator');
    if (declNode) {
      loop.iteratorVar = this.getNodeText(declNode);
    }

    const rightNode = this.getField(tsNode, 'right');
    if (rightNode) {
      loop.condition = this.getNodeText(rightNode);
      loop.boundVar = this.getNodeText(rightNode);
    }

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      loop.setBody(
        bodyNode.type === 'compound_statement'
          ? this.processCompoundStatement(bodyNode)
          : this.wrapInBlock(bodyNode)
      );
    }

    return loop;
  }

  /**
   * Process a while loop.
   * @param {object} tsNode
   * @returns {LoopNode}
   */
  processWhileLoop(tsNode) {
    const loop = new LoopNode('while', this.loc(tsNode));
    const condNode = this.getField(tsNode, 'condition');
    if (condNode) loop.condition = this.getNodeText(condNode);

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      loop.setBody(
        bodyNode.type === 'compound_statement'
          ? this.processCompoundStatement(bodyNode)
          : this.wrapInBlock(bodyNode)
      );
    }
    return loop;
  }

  /**
   * Process a do-while loop.
   * @param {object} tsNode
   * @returns {LoopNode}
   */
  processDoWhileLoop(tsNode) {
    const loop = new LoopNode('do-while', this.loc(tsNode));
    const condNode = this.getField(tsNode, 'condition');
    if (condNode) loop.condition = this.getNodeText(condNode);

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      loop.setBody(
        bodyNode.type === 'compound_statement'
          ? this.processCompoundStatement(bodyNode)
          : this.wrapInBlock(bodyNode)
      );
    }
    return loop;
  }

  /**
   * Process an if statement.
   * @param {object} tsNode
   * @returns {BranchNode}
   */
  processIfStatement(tsNode) {
    const branch = new BranchNode(this.loc(tsNode));

    const condNode = this.getField(tsNode, 'condition');
    if (condNode) branch.condition = this.getNodeText(condNode);

    const consequenceNode = this.getField(tsNode, 'consequence');
    if (consequenceNode) {
      branch.setConsequence(
        consequenceNode.type === 'compound_statement'
          ? this.processCompoundStatement(consequenceNode)
          : this.wrapInBlock(consequenceNode)
      );
    }

    const alternativeNode = this.getField(tsNode, 'alternative');
    if (alternativeNode) {
      if (alternativeNode.type === 'if_statement') {
        branch.setAlternative(this.processIfStatement(alternativeNode));
      } else if (alternativeNode.type === 'else_clause') {
        const elseBody = alternativeNode.namedChildren[0];
        if (elseBody) {
          branch.setAlternative(
            elseBody.type === 'compound_statement'
              ? this.processCompoundStatement(elseBody)
              : this.wrapInBlock(elseBody)
          );
        }
      } else {
        branch.setAlternative(
          alternativeNode.type === 'compound_statement'
            ? this.processCompoundStatement(alternativeNode)
            : this.wrapInBlock(alternativeNode)
        );
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
      this.extractCallsFromExpression(children[0], ret);
    }
    return ret;
  }

  /**
   * Recursively walk a CST expression to extract embedded function calls.
   * @param {object} tsNode
   * @param {IRNode} parent
   */
  extractCallsFromExpression(tsNode, parent) {
    if (!tsNode) return;
    if (tsNode.type === 'call_expression') {
      const callNode = this.processCallExpression(tsNode);
      if (callNode) parent.addChild(callNode);
      return;
    }
    for (const child of this.getNamedChildren(tsNode)) {
      this.extractCallsFromExpression(child, parent);
    }
  }

  /**
   * Process a declaration.
   * Detects STL containers, arrays, and new expressions.
   * @param {object} tsNode
   * @returns {VariableNode|AllocationNode}
   */
  processDeclaration(tsNode) {
    const typeNode = this.getField(tsNode, 'type');
    const typeName = typeNode ? this.getNodeText(typeNode) : null;

    // Check for STL container type
    if (typeName) {
      for (const containerType of STL_CONTAINERS) {
        if (typeName.includes(containerType)) {
          const alloc = new AllocationNode('collection', this.loc(tsNode));
          alloc.dataStructure = containerType;
          return alloc;
        }
      }
    }

    const declaratorNode = this.getField(tsNode, 'declarator');
    if (!declaratorNode) {
      return new ExpressionNode(this.getNodeText(tsNode), this.loc(tsNode));
    }

    // Array declarator
    if (declaratorNode.type === 'array_declarator') {
      const alloc = new AllocationNode('array', this.loc(tsNode));
      alloc.dataStructure = 'array';
      const sizeNode = this.getField(declaratorNode, 'size');
      if (sizeNode) alloc.sizeExpression = this.getNodeText(sizeNode);
      return alloc;
    }

    // Init declarator with potential new expression
    if (declaratorNode.type === 'init_declarator') {
      const nameNode = this.getField(declaratorNode, 'declarator');
      const valueNode = this.getField(declaratorNode, 'value');

      if (valueNode && valueNode.type === 'new_expression') {
        return this.processNewExpression(valueNode);
      }

      if (valueNode && valueNode.type === 'call_expression') {
        const funcNode = this.getField(valueNode, 'function');
        if (funcNode) {
          const funcName = this.getNodeText(funcNode);
          if (['malloc', 'calloc', 'realloc'].includes(funcName)) {
            const alloc = new AllocationNode('dynamic', this.loc(tsNode));
            alloc.dataStructure = 'heap';
            alloc.sizeExpression = this.getNodeText(valueNode);
            return alloc;
          }
        }
      }

      const name = nameNode ? this.getNodeText(nameNode) : '<unknown>';
      const varNode = new VariableNode(name, 'declaration', this.loc(tsNode));
      varNode.varType = typeName;
      if (valueNode) varNode.initialValue = this.getNodeText(valueNode);
      return varNode;
    }

    const name = this.getNodeText(declaratorNode);
    const varNode = new VariableNode(name, 'declaration', this.loc(tsNode));
    varNode.varType = typeName;
    return varNode;
  }

  /**
   * Process a new expression: new Type(...) or new Type[size]
   * @param {object} tsNode
   * @returns {AllocationNode}
   */
  processNewExpression(tsNode) {
    const alloc = new AllocationNode('dynamic', this.loc(tsNode));
    alloc.dataStructure = 'heap';

    const text = this.getNodeText(tsNode);
    // Detect new Type[size] pattern
    const arrayMatch = text.match(/new\s+\w+\[(.+)\]/);
    if (arrayMatch) {
      alloc.allocationType = 'array';
      alloc.dataStructure = 'array';
      alloc.sizeExpression = arrayMatch[1];
    }

    return alloc;
  }

  /**
   * Process an expression statement.
   * @param {object} tsNode
   * @returns {IRNode|null}
   */
  processExpressionStatement(tsNode) {
    const children = this.getNamedChildren(tsNode);
    if (children.length === 0) return null;

    const expr = children[0];

    if (expr.type === 'call_expression') {
      return this.processCallExpression(expr);
    }
    if (expr.type === 'assignment_expression') {
      return this.processAssignmentExpression(expr);
    }
    if (expr.type === 'new_expression') {
      return this.processNewExpression(expr);
    }
    if (expr.type === 'delete_expression') {
      return new ExpressionNode(this.getNodeText(expr), this.loc(expr));
    }

    return new ExpressionNode(this.getNodeText(expr), this.loc(expr));
  }

  /**
   * Process a call expression.
   * @param {object} tsNode
   * @returns {CallNode}
   */
  processCallExpression(tsNode) {
    const funcNode = this.getField(tsNode, 'function');
    if (!funcNode) return new ExpressionNode(this.getNodeText(tsNode), this.loc(tsNode));

    const funcName = this.getNodeText(funcNode);

    // Memory allocators
    if (['malloc', 'calloc', 'realloc'].includes(funcName)) {
      const alloc = new AllocationNode('dynamic', this.loc(tsNode));
      alloc.dataStructure = 'heap';
      return alloc;
    }

    const call = new CallNode(funcName, this.loc(tsNode));
    const argsNode = this.getField(tsNode, 'arguments');
    if (argsNode) {
      for (const arg of this.getNamedChildren(argsNode)) {
        call.arguments.push(this.getNodeText(arg));
      }
    }
    return call;
  }

  /**
   * Process an assignment expression.
   * @param {object} tsNode
   * @returns {VariableNode}
   */
  processAssignmentExpression(tsNode) {
    const leftNode = this.getField(tsNode, 'left');
    const rightNode = this.getField(tsNode, 'right');
    const name = leftNode ? this.getNodeText(leftNode) : '<unknown>';
    const varNode = new VariableNode(name, 'assignment', this.loc(tsNode));
    if (rightNode) varNode.initialValue = this.getNodeText(rightNode);
    return varNode;
  }

  /**
   * Wrap a single statement in a BlockNode.
   * @param {object} tsNode
   * @returns {BlockNode}
   */
  wrapInBlock(tsNode) {
    const block = new BlockNode(this.loc(tsNode));
    const node = this.processNode(tsNode);
    if (node) block.addStatement(node);
    return block;
  }
}
