/**
 * BaseParser - Abstract base class for language-specific parsers.
 *
 * Each language parser extends this class and implements the
 * `buildIR(tree)` method to convert a tree-sitter CST into
 * the common IR.
 */

import Parser from 'tree-sitter';
import {
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
  locationFromTSNode,
} from '../ir/nodes.js';

export class BaseParser {
  /**
   * @param {object} grammar - tree-sitter language grammar module
   * @param {string} languageName - 'c', 'cpp', 'java', 'python'
   */
  constructor(grammar, languageName) {
    this.languageName = languageName;
    this.parser = new Parser();
    this.parser.setLanguage(grammar);
  }

  /**
   * Parse source code and return an IR tree.
   * @param {string} code - Source code string
   * @returns {ProgramNode}
   */
  parse(code) {
    const tree = this.parser.parse(code);
    const rootNode = tree.rootNode;
    return this.buildIR(rootNode, code);
  }

  /**
   * Convert a tree-sitter CST root node into an IR ProgramNode.
   * Must be implemented by subclasses.
   * @param {object} rootNode - tree-sitter root CST node
   * @param {string} sourceCode - original source code
   * @returns {ProgramNode}
   */
  buildIR(rootNode, sourceCode) {
    throw new Error(`buildIR() not implemented for ${this.languageName}`);
  }

  /**
   * Get the text content of a tree-sitter node.
   * @param {object} tsNode
   * @returns {string}
   */
  getNodeText(tsNode) {
    return tsNode.text;
  }

  /**
   * Safely get a named child of a tree-sitter node.
   * @param {object} tsNode
   * @param {string} fieldName
   * @returns {object|null}
   */
  getField(tsNode, fieldName) {
    return tsNode.childForFieldName(fieldName) || null;
  }

  /**
   * Get all named children of a tree-sitter node.
   * @param {object} tsNode
   * @returns {object[]}
   */
  getNamedChildren(tsNode) {
    return tsNode.namedChildren || [];
  }

  /**
   * Create a location object from a tree-sitter node.
   * @param {object} tsNode
   * @returns {object}
   */
  loc(tsNode) {
    return locationFromTSNode(tsNode);
  }

  /**
   * Try to extract a numeric literal value from a tree-sitter node.
   * Returns the number if the node is a simple numeric literal, null otherwise.
   * @param {object} tsNode
   * @returns {number|null}
   */
  extractNumericValue(tsNode) {
    if (!tsNode) return null;
    const text = this.getNodeText(tsNode).trim();
    const num = Number(text);
    return Number.isFinite(num) ? num : null;
  }

  /**
   * Check if a tree-sitter node represents an identifier.
   * @param {object} tsNode
   * @returns {boolean}
   */
  isIdentifier(tsNode) {
    return tsNode && tsNode.type === 'identifier';
  }

  /**
   * Analyze a for-loop's init/condition/update to extract iteration metadata.
   * This is a best-effort analysis - returns null fields when info isn't extractable.
   *
   * @param {object} initNode - tree-sitter node for initialization
   * @param {object} conditionNode - tree-sitter node for condition
   * @param {object} updateNode - tree-sitter node for update
   * @returns {{ iteratorVar, boundVar, initValue, incrementType, incrementValue }}
   */
  analyzeForLoopStructure(initNode, conditionNode, updateNode) {
    const result = {
      iteratorVar: null,
      boundVar: null,
      initValue: null,
      incrementType: 'unknown',
      incrementValue: null,
    };

    // Try to extract iterator variable and init value from init
    if (initNode) {
      const initText = this.getNodeText(initNode);
      // Match patterns like: i=0, int i=0, i = 0
      const initMatch = initText.match(/(\w+)\s*=\s*(\w+)/);
      if (initMatch) {
        result.iteratorVar = initMatch[1];
        const val = Number(initMatch[2]);
        result.initValue = Number.isFinite(val) ? val : initMatch[2];
      }
    }

    // Try to extract bound variable from condition
    if (conditionNode) {
      const condText = this.getNodeText(conditionNode);
      // Match patterns like: i < n, i <= n*n, i > 0
      const condMatch = condText.match(/(\w+)\s*(<|<=|>|>=|!=)\s*(.+)/);
      if (condMatch) {
        if (!result.iteratorVar) {
          result.iteratorVar = condMatch[1];
        }
        result.boundVar = condMatch[3].trim();
      }
    }

    // Try to extract increment type from update
    if (updateNode) {
      const updateText = this.getNodeText(updateNode);

      // i++ or ++i or i--  or --i
      if (/\+\+/.test(updateText) || /--/.test(updateText)) {
        result.incrementType = 'additive';
        result.incrementValue = 1;
      }
      // i += k or i -= k
      else if (/(\w+)\s*\+=\s*(\w+)/.test(updateText)) {
        result.incrementType = 'additive';
        const match = updateText.match(/(\w+)\s*\+=\s*(\w+)/);
        const val = Number(match[2]);
        result.incrementValue = Number.isFinite(val) ? val : match[2];
      }
      else if (/(\w+)\s*-=\s*(\w+)/.test(updateText)) {
        result.incrementType = 'additive';
        const match = updateText.match(/(\w+)\s*-=\s*(\w+)/);
        const val = Number(match[2]);
        result.incrementValue = Number.isFinite(val) ? val : match[2];
      }
      // i *= k
      else if (/(\w+)\s*\*=\s*(\w+)/.test(updateText)) {
        result.incrementType = 'multiplicative';
        const match = updateText.match(/(\w+)\s*\*=\s*(\w+)/);
        const val = Number(match[2]);
        result.incrementValue = Number.isFinite(val) ? val : match[2];
      }
      // i /= k
      else if (/(\w+)\s*\/=\s*(\w+)/.test(updateText)) {
        result.incrementType = 'multiplicative';
        const match = updateText.match(/(\w+)\s*\/=\s*(\w+)/);
        const val = Number(match[2]);
        result.incrementValue = Number.isFinite(val) ? val : match[2];
      }
      // i = i * k
      else if (/(\w+)\s*=\s*\1\s*\*\s*(\w+)/.test(updateText)) {
        result.incrementType = 'multiplicative';
        const match = updateText.match(/(\w+)\s*=\s*\1\s*\*\s*(\w+)/);
        result.incrementValue = Number(match[2]) || match[2];
      }
      // i = i / k
      else if (/(\w+)\s*=\s*\1\s*\/\s*(\w+)/.test(updateText)) {
        result.incrementType = 'multiplicative';
        const match = updateText.match(/(\w+)\s*=\s*\1\s*\/\s*(\w+)/);
        result.incrementValue = Number(match[2]) || match[2];
      }
    }

    return result;
  }
}

// Re-export IR nodes for convenience in parser implementations
export {
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
  locationFromTSNode,
};
