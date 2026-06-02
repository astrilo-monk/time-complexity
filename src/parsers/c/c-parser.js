/**
 * C Parser Adapter
 *
 * Converts tree-sitter C CST into the common IR.
 * Handles function definitions, for/while/do-while loops,
 * branches, calls, declarations, and memory allocations.
 */

import CLanguage from 'tree-sitter-c';
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

export class CParser extends BaseParser {
  constructor() {
    super(CLanguage, 'c');
  }

  /**
   * Build IR from tree-sitter C CST root.
   * @param {object} rootNode
   * @param {string} sourceCode
   * @returns {ProgramNode}
   */
  buildIR(rootNode, sourceCode) {
    const program = new ProgramNode('c', this.loc(rootNode));

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
      default:
        return null;
    }
  }

  /**
   * Process a function definition.
   * C function structure: type declarator(params) { body }
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
   * Extract function name from a declarator node.
   * Handles plain and pointer declarators.
   * @param {object} declaratorNode
   * @returns {string}
   */
  extractFunctionName(declaratorNode) {
    if (!declaratorNode) return '<anonymous>';

    // Direct function_declarator: name(params)
    if (declaratorNode.type === 'function_declarator') {
      const nameNode = this.getField(declaratorNode, 'declarator');
      return nameNode ? this.getNodeText(nameNode) : '<anonymous>';
    }

    // Pointer declarator: *name(params)
    if (declaratorNode.type === 'pointer_declarator') {
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
    // Navigate through pointer declarators to find the function_declarator
    while (funcDecl && funcDecl.type !== 'function_declarator') {
      funcDecl = this.getField(funcDecl, 'declarator');
    }
    if (!funcDecl) return [];

    const paramsNode = this.getField(funcDecl, 'parameters');
    if (!paramsNode) return [];

    const params = [];
    for (const child of this.getNamedChildren(paramsNode)) {
      if (child.type === 'parameter_declaration') {
        const declNode = this.getField(child, 'declarator');
        if (declNode) {
          // Strip pointer declarator wrapping
          let nameNode = declNode;
          while (nameNode.type === 'pointer_declarator') {
            nameNode = this.getField(nameNode, 'declarator') || nameNode;
            if (nameNode.type === 'pointer_declarator') continue;
            break;
          }
          params.push(this.getNodeText(nameNode));
        }
      }
    }

    return params;
  }

  /**
   * Process a compound statement (block enclosed in braces).
   * @param {object} tsNode
   * @returns {BlockNode}
   */
  processCompoundStatement(tsNode) {
    const block = new BlockNode(this.loc(tsNode));

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
   * C for: for(init; condition; update) body
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

    // Analyze loop structure for complexity metadata
    const structure = this.analyzeForLoopStructure(initNode, condNode, updateNode);
    loop.iteratorVar = structure.iteratorVar;
    loop.boundVar = structure.boundVar;
    loop.initValue = structure.initValue;
    loop.incrementType = structure.incrementType;
    loop.incrementValue = structure.incrementValue;

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      const body = bodyNode.type === 'compound_statement'
        ? this.processCompoundStatement(bodyNode)
        : this.wrapInBlock(bodyNode);
      loop.setBody(body);
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
    if (condNode) {
      loop.condition = this.getNodeText(condNode);
    }

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      const body = bodyNode.type === 'compound_statement'
        ? this.processCompoundStatement(bodyNode)
        : this.wrapInBlock(bodyNode);
      loop.setBody(body);
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
    if (condNode) {
      loop.condition = this.getNodeText(condNode);
    }

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      const body = bodyNode.type === 'compound_statement'
        ? this.processCompoundStatement(bodyNode)
        : this.wrapInBlock(bodyNode);
      loop.setBody(body);
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
    if (condNode) {
      branch.condition = this.getNodeText(condNode);
    }

    const consequenceNode = this.getField(tsNode, 'consequence');
    if (consequenceNode) {
      const body = consequenceNode.type === 'compound_statement'
        ? this.processCompoundStatement(consequenceNode)
        : this.wrapInBlock(consequenceNode);
      branch.setConsequence(body);
    }

    const alternativeNode = this.getField(tsNode, 'alternative');
    if (alternativeNode) {
      if (alternativeNode.type === 'if_statement') {
        branch.setAlternative(this.processIfStatement(alternativeNode));
      } else if (alternativeNode.type === 'else_clause') {
        const elseBody = alternativeNode.namedChildren[0];
        if (elseBody) {
          const body = elseBody.type === 'compound_statement'
            ? this.processCompoundStatement(elseBody)
            : this.wrapInBlock(elseBody);
          branch.setAlternative(body);
        }
      } else {
        const body = alternativeNode.type === 'compound_statement'
          ? this.processCompoundStatement(alternativeNode)
          : this.wrapInBlock(alternativeNode);
        branch.setAlternative(body);
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
    }
    return ret;
  }

  /**
   * Recursively walk a CST expression node to extract embedded function calls.
   * Needed for expressions like `n * factorial(n-1)`.
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
   * Process a declaration (variable or array).
   * @param {object} tsNode
   * @returns {VariableNode|AllocationNode}
   */
  processDeclaration(tsNode) {
    const typeNode = this.getField(tsNode, 'type');
    const typeName = typeNode ? this.getNodeText(typeNode) : null;

    const declaratorNode = this.getField(tsNode, 'declarator');
    if (!declaratorNode) {
      return new ExpressionNode(this.getNodeText(tsNode), this.loc(tsNode));
    }

    // Check for array declarations: int arr[n]
    if (declaratorNode.type === 'array_declarator') {
      const alloc = new AllocationNode('array', this.loc(tsNode));
      alloc.dataStructure = 'array';
      const sizeNode = this.getField(declaratorNode, 'size');
      if (sizeNode) {
        alloc.sizeExpression = this.getNodeText(sizeNode);
      }
      return alloc;
    }

    // Check for init_declarator (with assignment)
    if (declaratorNode.type === 'init_declarator') {
      const nameNode = this.getField(declaratorNode, 'declarator');
      const valueNode = this.getField(declaratorNode, 'value');

      // Check if value is a malloc/calloc call
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
      if (valueNode) {
        varNode.initialValue = this.getNodeText(valueNode);
      }
      return varNode;
    }

    // Plain declaration without init
    const name = this.getNodeText(declaratorNode);
    const varNode = new VariableNode(name, 'declaration', this.loc(tsNode));
    varNode.varType = typeName;
    return varNode;
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
    if (expr.type === 'update_expression') {
      return new ExpressionNode(this.getNodeText(expr), this.loc(expr));
    }

    return new ExpressionNode(this.getNodeText(expr), this.loc(expr));
  }

  /**
   * Process a call expression.
   * @param {object} tsNode
   * @returns {CallNode|AllocationNode}
   */
  processCallExpression(tsNode) {
    const funcNode = this.getField(tsNode, 'function');
    if (!funcNode) return new ExpressionNode(this.getNodeText(tsNode), this.loc(tsNode));

    const funcName = this.getNodeText(funcNode);

    // Check for memory allocation functions
    if (['malloc', 'calloc', 'realloc'].includes(funcName)) {
      const alloc = new AllocationNode('dynamic', this.loc(tsNode));
      alloc.dataStructure = 'heap';
      const argsNode = this.getField(tsNode, 'arguments');
      if (argsNode) {
        alloc.sizeExpression = this.getNodeText(argsNode);
      }
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
    if (rightNode) {
      varNode.initialValue = this.getNodeText(rightNode);
    }
    return varNode;
  }

  /**
   * Wrap a single statement in a BlockNode.
   * Used when a loop/if body is a single statement without braces.
   * @param {object} tsNode
   * @returns {BlockNode}
   */
  wrapInBlock(tsNode) {
    const block = new BlockNode(this.loc(tsNode));
    const node = this.processNode(tsNode);
    if (node) {
      block.addStatement(node);
    }
    return block;
  }
}
