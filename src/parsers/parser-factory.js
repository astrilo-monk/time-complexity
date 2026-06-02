/**
 * ParserFactory - Returns the correct parser for a given language.
 */

import { CParser } from './c/c-parser.js';
import { CppParser } from './cpp/cpp-parser.js';
import { JavaParser } from './java/java-parser.js';
import { PythonParser } from './python/python-parser.js';

const SUPPORTED_LANGUAGES = ['c', 'cpp', 'java', 'python'];

// Cache parser instances since tree-sitter init has overhead
const parserCache = new Map();

/**
 * Get a parser instance for the specified language.
 * Parser instances are cached for reuse.
 *
 * @param {string} language - 'c', 'cpp', 'java', or 'python'
 * @returns {BaseParser}
 * @throws {Error} if language is not supported
 */
export function getParser(language) {
  const lang = language.toLowerCase().trim();

  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    throw new Error(
      `Unsupported language: "${language}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}`
    );
  }

  if (parserCache.has(lang)) {
    return parserCache.get(lang);
  }

  let parser;
  switch (lang) {
    case 'c':
      parser = new CParser();
      break;
    case 'cpp':
      parser = new CppParser();
      break;
    case 'java':
      parser = new JavaParser();
      break;
    case 'python':
      parser = new PythonParser();
      break;
  }

  parserCache.set(lang, parser);
  return parser;
}

/**
 * Check if a language is supported.
 * @param {string} language
 * @returns {boolean}
 */
export function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.includes(language.toLowerCase().trim());
}

/**
 * Get list of supported languages.
 * @returns {string[]}
 */
export function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Clear the parser cache. Useful for testing.
 */
export function clearParserCache() {
  parserCache.clear();
}
