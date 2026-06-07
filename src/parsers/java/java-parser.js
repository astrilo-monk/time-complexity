/**
 * Java Parser Adapter
 *
 * Converts tree-sitter Java CST into the common IR.
 * Handles method declarations, for/enhanced-for/while/do-while loops,
 * branches, method invocations, object creation, and collection detection.
 */

import JavaLanguage from 'tree-sitter-java';
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

/** Java collection types that imply heap allocation */
const JAVA_COLLECTIONS = new Set([
  'ArrayList', 'LinkedList', 'Vector', 'Stack',
  'HashMap', 'LinkedHashMap', 'TreeMap', 'Hashtable', 'ConcurrentHashMap',
  'HashSet', 'LinkedHashSet', 'TreeSet',
  'PriorityQueue', 'ArrayDeque', 'LinkedBlockingQueue',
]);

export class JavaParser extends BaseParser {
  constructor() {
    super(JavaLanguage, 'java');
  }

  /**
   * Build IR from tree-sitter Java CST root.
   * Java programs contain class declarations which contain method declarations.
   * @param {object} rootNode
   * @param {string} sourceCode
   * @returns {ProgramNode}
   */
  buildIR(rootNode, sourceCode) {
    const program = new ProgramNode('java', this.loc(rootNode));
    this.walkForFunctions(rootNode, program);
    return program;
  }

  /**
   * Recursively walk CST to find method/constructor declarations
   * inside class bodies.
   * @param {object} tsNode
   * @param {ProgramNode} program
   */
  walkForFunctions(tsNode, program) {
    for (const child of this.getNamedChildren(tsNode)) {
      if (child.type === 'method_declaration' || child.type === 'constructor_declaration') {
        const func = this.processMethod(child);
        if (func) program.addFunction(func);
      } else if (
        child.type === 'class_declaration' ||
        child.type === 'class_body' ||
        child.type === 'program' ||
        child.type === 'interface_declaration' ||
        child.type === 'interface_body' ||
        child.type === 'enum_declaration' ||
        child.type === 'enum_body'
      ) {
        // Recurse into class/interface bodies
        this.walkForFunctions(child, program);
      }
    }
  }

  /**
   * Process a single CST node into the corresponding IR node.
   * @param {object} tsNode
   * @returns {IRNode|null}
   */
  processNode(tsNode) {
    if (!tsNode) return null;

    switch (tsNode.type) {
      case 'method_declaration':
      case 'constructor_declaration':
        return this.processMethod(tsNode);
      case 'for_statement':
        return this.processForLoop(tsNode);
      case 'enhanced_for_statement':
        return this.processEnhancedForLoop(tsNode);
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
      case 'block':
        return this.processBlock(tsNode);
      case 'local_variable_declaration':
        return this.processLocalVarDeclaration(tsNode);
      case 'expression_statement':
        return this.processExpressionStatement(tsNode);
      default:
        return null;
    }
  }

  /**
   * Process a method or constructor declaration.
   * @param {object} tsNode
   * @returns {FunctionNode}
   */
  processMethod(tsNode) {
    let name;
    if (tsNode.type === 'constructor_declaration') {
      const nameNode = this.getField(tsNode, 'name');
      name = nameNode ? this.getNodeText(nameNode) : '<constructor>';
    } else {
      const nameNode = this.getField(tsNode, 'name');
      name = nameNode ? this.getNodeText(nameNode) : '<anonymous>';
    }

    const paramsNode = this.getField(tsNode, 'parameters');
    const params = this.extractParams(paramsNode);

    const typeNode = this.getField(tsNode, 'type');
    const returnType = typeNode ? this.getNodeText(typeNode) : null;

    const func = new FunctionNode(name, params, this.loc(tsNode));
    func.returnType = returnType;

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      func.setBody(this.processBlock(bodyNode));
    }

    return func;
  }

  /**
   * Extract parameter names from formal_parameters.
   * @param {object} paramsNode
   * @returns {string[]}
   */
  extractParams(paramsNode) {
    if (!paramsNode) return [];
    const params = [];

    for (const child of this.getNamedChildren(paramsNode)) {
      if (child.type === 'formal_parameter' || child.type === 'spread_parameter') {
        const nameNode = this.getField(child, 'name');
        if (nameNode) params.push(this.getNodeText(nameNode));
      }
    }

    return params;
  }

  /**
   * Process a block (brace-enclosed).
   * @param {object} tsNode
   * @returns {BlockNode}
   */
  processBlock(tsNode) {
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

    const initNode = this.getField(tsNode, 'init');
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
        bodyNode.type === 'block'
          ? this.processBlock(bodyNode)
          : this.wrapInBlock(bodyNode)
      );
    }

    return loop;
  }

  /**
   * Process an enhanced for loop: for(Type x : collection)
   * @param {object} tsNode
   * @returns {LoopNode}
   */
  processEnhancedForLoop(tsNode) {
    const loop = new LoopNode('for-each', this.loc(tsNode));

    const nameNode = this.getField(tsNode, 'name');
    if (nameNode) {
      loop.iteratorVar = this.getNodeText(nameNode);
    }

    const valueNode = this.getField(tsNode, 'value');
    if (valueNode) {
      loop.condition = this.getNodeText(valueNode);
      loop.boundVar = this.getNodeText(valueNode);
    }

    const bodyNode = this.getField(tsNode, 'body');
    if (bodyNode) {
      loop.setBody(
        bodyNode.type === 'block'
          ? this.processBlock(bodyNode)
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
        bodyNode.type === 'block'
          ? this.processBlock(bodyNode)
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
        bodyNode.type === 'block'
          ? this.processBlock(bodyNode)
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
        consequenceNode.type === 'block'
          ? this.processBlock(consequenceNode)
          : this.wrapInBlock(consequenceNode)
      );
    }

    const alternativeNode = this.getField(tsNode, 'alternative');
    if (alternativeNode) {
      if (alternativeNode.type === 'if_statement') {
        branch.setAlternative(this.processIfStatement(alternativeNode));
      } else if (alternativeNode.type === 'block') {
        branch.setAlternative(this.processBlock(alternativeNode));
      } else {
        branch.setAlternative(this.wrapInBlock(alternativeNode));
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
    if (tsNode.type === 'method_invocation') {
      const callNode = this.processMethodInvocation(tsNode);
      if (callNode) parent.addChild(callNode);
      return;
    }
    for (const child of this.getNamedChildren(tsNode)) {
      this.extractCallsFromExpression(child, parent);
    }
  }

  /**
   * Process a local variable declaration.
   * @param {object} tsNode
   * @returns {VariableNode|AllocationNode}
   */
  processLocalVarDeclaration(tsNode) {
    const typeNode = this.getField(tsNode, 'type');
    const typeName = typeNode ? this.getNodeText(typeNode) : null;

    const declaratorNode = this.getField(tsNode, 'declarator');
    const nameNode = declaratorNode ? this.getField(declaratorNode, 'name') : null;
    
    // Check for collection types in the type name
    if (typeName) {
      for (const collType of JAVA_COLLECTIONS) {
        if (typeName.includes(collType)) {
          const alloc = new AllocationNode('collection', this.loc(tsNode));
          alloc.dataStructure = collType;
          alloc.name = nameNode ? this.getNodeText(nameNode) : undefined;
          alloc.text = this.getNodeText(tsNode);
          return alloc;
        }
      }
    }

    if (!declaratorNode) {
      return new ExpressionNode(this.getNodeText(tsNode), this.loc(tsNode));
    }

    // variable_declarator has name and value fields
    const valueNode = this.getField(declaratorNode, 'value');

    // Check if value is an object creation (new Type(...))
    if (valueNode && valueNode.type === 'object_creation_expression') {
      const obj = this.processObjectCreation(valueNode);
      obj.name = nameNode ? this.getNodeText(nameNode) : undefined;
      obj.text = this.getNodeText(tsNode);
      return obj;
    }

    // Check if value is array creation (new int[n])
    if (valueNode && valueNode.type === 'array_creation_expression') {
      const arr = this.processArrayCreation(valueNode);
      arr.name = nameNode ? this.getNodeText(nameNode) : undefined;
      arr.text = this.getNodeText(tsNode);
      return arr;
    }

    const name = nameNode ? this.getNodeText(nameNode) : '<unknown>';
    const varNode = new VariableNode(name, 'declaration', this.loc(tsNode));
    varNode.varType = typeName;
    if (valueNode) varNode.initialValue = this.getNodeText(valueNode);
    return varNode;
  }

  /**
   * Process an object creation expression: new ArrayList<>()
   * @param {object} tsNode
   * @returns {AllocationNode|CallNode}
   */
  processObjectCreation(tsNode) {
    const typeNode = this.getField(tsNode, 'type');
    const typeName = typeNode ? this.getNodeText(typeNode) : null;

    // Check if it's a known collection type
    if (typeName) {
      for (const collType of JAVA_COLLECTIONS) {
        if (typeName.includes(collType)) {
          const alloc = new AllocationNode('collection', this.loc(tsNode));
          alloc.dataStructure = collType;
          return alloc;
        }
      }
    }

    const alloc = new AllocationNode('object', this.loc(tsNode));
    alloc.dataStructure = typeName || 'unknown';
    return alloc;
  }

  /**
   * Process an array creation expression: new int[n]
   * @param {object} tsNode
   * @returns {AllocationNode}
   */
  processArrayCreation(tsNode) {
    const alloc = new AllocationNode('array', this.loc(tsNode));
    alloc.dataStructure = 'array';

    // Try to extract size from dimensions
    const text = this.getNodeText(tsNode);
    // Extract all bracketed sizes: e.g., [n][m] -> n, m
    const dimensions = [];
    const regex = /\[(.*?)\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1].trim() !== '') {
        dimensions.push(match[1].trim());
      }
    }
    
    if (dimensions.length > 0) {
      alloc.sizeExpression = dimensions.join('*');
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

    if (expr.type === 'method_invocation') {
      return this.processMethodInvocation(expr);
    }
    if (expr.type === 'assignment_expression') {
      return this.processAssignmentExpression(expr);
    }
    if (expr.type === 'object_creation_expression') {
      return this.processObjectCreation(expr);
    }
    if (expr.type === 'update_expression') {
      return new ExpressionNode(this.getNodeText(expr), this.loc(expr));
    }

    return new ExpressionNode(this.getNodeText(expr), this.loc(expr));
  }

  /**
   * Process a method invocation.
   * @param {object} tsNode
   * @returns {CallNode}
   */
  processMethodInvocation(tsNode) {
    const nameNode = this.getField(tsNode, 'name');
    const objectNode = this.getField(tsNode, 'object');

    let funcName;
    if (objectNode && nameNode) {
      funcName = `${this.getNodeText(objectNode)}.${this.getNodeText(nameNode)}`;
    } else if (nameNode) {
      funcName = this.getNodeText(nameNode);
    } else {
      funcName = this.getNodeText(tsNode);
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
