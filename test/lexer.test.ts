import { describe, it, expect } from 'vitest';
import { lex, TokenKind } from '../src/lexer.js';

function kinds(src: string): TokenKind[] {
  return lex(src).map(t => t.kind);
}

function values(src: string): string[] {
  return lex(src).map(t => t.value);
}

describe('Lexer', () => {
  it('should lex empty input', () => {
    expect(kinds('')).toEqual([TokenKind.Eof]);
  });

  it('should lex variable assignment', () => {
    const tokens = lex('name := "hello"');
    const k = tokens.map(t => t.kind);
    expect(k).toContain(TokenKind.Identifier);
    expect(k).toContain(TokenKind.ColonEquals);
    expect(k).toContain(TokenKind.StringLiteral);
  });

  it('should lex identifiers with hyphens', () => {
    const tokens = lex('my-var := "x"');
    expect(tokens[0].value).toBe('my-var');
  });

  it('should lex backticks', () => {
    const tokens = lex('hash := `git rev-parse HEAD`');
    const bt = tokens.find(t => t.kind === TokenKind.Backtick);
    expect(bt).toBeDefined();
    expect(bt!.value).toBe('git rev-parse HEAD');
  });

  it('should lex single-quoted strings', () => {
    const tokens = lex("x := 'hello'");
    const s = tokens.find(t => t.kind === TokenKind.StringLiteral);
    expect(s!.value).toBe('hello');
  });

  it('should lex double-quoted strings with escapes', () => {
    const tokens = lex('x := "hello\\nworld"');
    const s = tokens.find(t => t.kind === TokenKind.StringLiteral);
    expect(s!.value).toBe('hello\nworld');
  });

  it('should lex comments', () => {
    const tokens = lex('# this is a comment');
    expect(tokens[0].kind).toBe(TokenKind.Comment);
  });

  it('should lex recipe header', () => {
    const tokens = lex('build:');
    const k = tokens.map(t => t.kind);
    expect(k).toContain(TokenKind.Identifier);
    expect(k).toContain(TokenKind.Colon);
  });

  it('should lex recipe with body', () => {
    const src = 'build:\n    echo hello\n';
    const tokens = lex(src);
    const k = tokens.map(t => t.kind);
    expect(k).toContain(TokenKind.Indent);
    expect(k).toContain(TokenKind.Text);
    expect(k).toContain(TokenKind.Dedent);
  });

  it('should lex interpolation in body', () => {
    const src = 'greet:\n    echo {{name}}\n';
    const tokens = lex(src);
    const k = tokens.map(t => t.kind);
    expect(k).toContain(TokenKind.InterpolationStart);
    expect(k).toContain(TokenKind.Identifier);
    expect(k).toContain(TokenKind.InterpolationEnd);
  });

  it('should lex @ prefix', () => {
    const tokens = lex('@build:');
    expect(tokens[0].kind).toBe(TokenKind.At);
  });

  it('should lex recipe with dependencies', () => {
    const tokens = lex('test: build lint');
    const ids = tokens.filter(t => t.kind === TokenKind.Identifier);
    expect(ids.map(t => t.value)).toEqual(['test', 'build', 'lint']);
  });

  it('should lex recipe with parameters', () => {
    const tokens = lex('deploy target:');
    const ids = tokens.filter(t => t.kind === TokenKind.Identifier);
    expect(ids.map(t => t.value)).toEqual(['deploy', 'target']);
  });

  it('should lex multiple recipes', () => {
    const src = 'build:\n    echo build\n\ntest:\n    echo test\n';
    const tokens = lex(src);
    const indents = tokens.filter(t => t.kind === TokenKind.Indent).length;
    const dedents = tokens.filter(t => t.kind === TokenKind.Dedent).length;
    expect(indents).toBe(dedents);
  });

  it('should handle plus and star for variadic params', () => {
    const tokens = lex('+args');
    expect(tokens[0].kind).toBe(TokenKind.Plus);
  });
});
