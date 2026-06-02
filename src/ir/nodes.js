/**
 * IR Node Types for the Complexity Analyzer
 *
 * These nodes form a language-agnostic intermediate representation.
 * Language-specific parsers convert their CST (concrete syntax tree)
 * into this IR so that analyzers can work against a single tree structure
 * regardless of source language.
 */

/**
 * Base class for all IR nodes.
 * Stores children, source location info, and metadata.
 */
export class IRNode {
  /**
   * @param {string} type - Node type identifier
   * @param {object} [location] - Source location { startLine, endLine, startCol, endCol }
   */
  constructor(type, location = null) {
    this.type = type;
    this.children = [];
    this.location = location;
    this.metadata = {};
  }

  addChild(node) {
    if (node) {
      this.children.push(node);
    }
    return this;
  }

  addChildren(nodes) {
    for (const node of nodes) {
      this.addChild(node);
    }
    return this;
  }

  /**
   * Find all descendant nodes matching a predicate.
   * @param {function} predicate - (node) => boolean
   * @returns {IRNode[]}
   */
  findAll(predicate) {
    const results = [];
    this._walk(node => {
      if (predicate(node)) {
        results.push(node);
      }
    });
    return results;
  }

  /**
   * Find the first descendant node matching a predicate.
   * @param {function} predicate
   * @returns {IRNode|null}
   */
  findFirst(predicate) {
    let result = null;
    this._walk(node => {
      if (!result && predicate(node)) {
        result = node;
      }
    });
    return result;
  }

  /**
   * Walk the tree depth-first, calling visitor on each node.
   * @param {function} visitor
   */
  _walk(visitor) {
    visitor(this);
    for (const child of this.children) {
      child._walk(visitor);
    }
  }
}

/**
 * Root node of a parsed program.
 */
export class ProgramNode extends IRNode {
  /**
   * @param {string} language - Source language ('c', 'cpp', 'java', 'python')
   * @param {object} [location]
   */
  constructor(language, location = null) {
    super('program', location);
    this.language = language;
    this.functions = [];
  }

  addFunction(funcNode) {
    this.functions.push(funcNode);
    this.addChild(funcNode);
    return this;
  }
}

/**
 * Function or method definition.
 */
export class FunctionNode extends IRNode {
  /**
   * @param {string} name - Function name
   * @param {string[]} params - Parameter names
   * @param {object} [location]
   */
  constructor(name, params = [], location = null) {
    super('function', location);
    this.name = name;
    this.params = params;
    this.body = null;
    this.returnType = null;
    this.isRecursive = false;       // Set during analysis
    this.recursiveCalls = [];       // CallNodes that recurse into this function
  }

  setBody(blockNode) {
    this.body = blockNode;
    if (blockNode) {
      this.addChild(blockNode);
    }
    return this;
  }
}

/**
 * A block of statements (function body, loop body, etc.)
 */
export class BlockNode extends IRNode {
  constructor(location = null) {
    super('block', location);
    this.statements = [];
  }

  addStatement(stmt) {
    if (stmt) {
      this.statements.push(stmt);
      this.addChild(stmt);
    }
    return this;
  }
}

/**
 * Loop construct (for, while, do-while).
 */
export class LoopNode extends IRNode {
  /**
   * @param {'for'|'while'|'do-while'|'for-each'} loopType
   * @param {object} [location]
   */
  constructor(loopType, location = null) {
    super('loop', location);
    this.loopType = loopType;

    // For-loop parts (null for while/do-while)
    this.init = null;       // Initialization expression info
    this.condition = null;  // Condition expression info
    this.update = null;     // Update expression info

    this.body = null;       // BlockNode

    // Analyzed metadata (filled by analyzers, not parsers)
    this.iteratorVar = null;
    this.boundVar = null;
    this.initValue = null;
    this.incrementType = null; // 'additive', 'multiplicative', 'unknown'
    this.incrementValue = null;
  }

  setBody(blockNode) {
    this.body = blockNode;
    if (blockNode) {
      this.addChild(blockNode);
    }
    return this;
  }
}

/**
 * Conditional branch (if/else if/else).
 */
export class BranchNode extends IRNode {
  constructor(location = null) {
    super('branch', location);
    this.condition = null;
    this.consequence = null;  // BlockNode for the if-body
    this.alternative = null;  // BlockNode or BranchNode (else/else-if)
  }

  setConsequence(blockNode) {
    this.consequence = blockNode;
    if (blockNode) {
      this.addChild(blockNode);
    }
    return this;
  }

  setAlternative(node) {
    this.alternative = node;
    if (node) {
      this.addChild(node);
    }
    return this;
  }
}

/**
 * Function or method call.
 */
export class CallNode extends IRNode {
  /**
   * @param {string} functionName - Name of the called function
   * @param {object} [location]
   */
  constructor(functionName, location = null) {
    super('call', location);
    this.functionName = functionName;
    this.arguments = [];      // Argument expression descriptions
    this.isRecursive = false;  // Set during analysis
  }
}

/**
 * Variable declaration or assignment.
 */
export class VariableNode extends IRNode {
  /**
   * @param {string} name
   * @param {'declaration'|'assignment'} kind
   * @param {object} [location]
   */
  constructor(name, kind, location = null) {
    super('variable', location);
    this.name = name;
    this.kind = kind;
    this.varType = null;        // Declared type if available
    this.initialValue = null;   // Initial value expression description
  }
}

/**
 * Memory allocation (malloc, new, list creation, etc.)
 */
export class AllocationNode extends IRNode {
  /**
   * @param {string} allocationType - 'array', 'object', 'dynamic', 'collection'
   * @param {object} [location]
   */
  constructor(allocationType, location = null) {
    super('allocation', location);
    this.allocationType = allocationType;
    this.dataStructure = null;   // 'array', 'vector', 'list', 'map', 'set', etc.
    this.sizeExpression = null;  // String describing the size if detectable
  }
}

/**
 * Return statement.
 */
export class ReturnNode extends IRNode {
  constructor(location = null) {
    super('return', location);
    this.value = null;  // Expression description
  }
}

/**
 * Break statement.
 */
export class BreakNode extends IRNode {
  constructor(location = null) {
    super('break', location);
  }
}

/**
 * Continue statement.
 */
export class ContinueNode extends IRNode {
  constructor(location = null) {
    super('continue', location);
  }
}

/**
 * Expression node — catch-all for expressions that don't fit other categories.
 * Stores the raw expression text for analysis.
 */
export class ExpressionNode extends IRNode {
  /**
   * @param {string} expressionText - Raw text of the expression
   * @param {object} [location]
   */
  constructor(expressionText, location = null) {
    super('expression', location);
    this.expressionText = expressionText;
  }
}

/**
 * Utility: extract source location from a tree-sitter node.
 * @param {object} tsNode - tree-sitter node
 * @returns {object} location
 */
export function locationFromTSNode(tsNode) {
  return {
    startLine: tsNode.startPosition.row + 1,
    endLine: tsNode.endPosition.row + 1,
    startCol: tsNode.startPosition.column,
    endCol: tsNode.endPosition.column,
  };
}
