/**
 * Tests for the parser factory
 */

import { describe, it, expect } from 'vitest';
import {
  getParser,
  isLanguageSupported,
  getSupportedLanguages,
  clearParserCache,
} from '../../../src/parsers/parser-factory.js';

describe('ParserFactory', () => {
  it('should return parser for each supported language', () => {
    clearParserCache();
    const languages = ['c', 'cpp', 'java', 'python'];
    for (const lang of languages) {
      const parser = getParser(lang);
      expect(parser).toBeDefined();
      expect(parser.languageName).toBe(lang);
    }
  });

  it('should cache parser instances', () => {
    clearParserCache();
    const p1 = getParser('python');
    const p2 = getParser('python');
    expect(p1).toBe(p2);
  });

  it('should throw for unsupported language', () => {
    expect(() => getParser('ruby')).toThrow('Unsupported language');
  });

  it('should handle case-insensitive input', () => {
    clearParserCache();
    const p = getParser('Python');
    expect(p.languageName).toBe('python');
  });

  it('isLanguageSupported should return correct values', () => {
    expect(isLanguageSupported('python')).toBe(true);
    expect(isLanguageSupported('c')).toBe(true);
    expect(isLanguageSupported('ruby')).toBe(false);
  });

  it('getSupportedLanguages should return all four', () => {
    const langs = getSupportedLanguages();
    expect(langs).toEqual(['c', 'cpp', 'java', 'python']);
  });
});
