import { describe, it, expect } from 'vitest';
import { evaluateExpression, evaluateAssignments } from '../src/evaluator.js';
import { parseJustfile } from '../src/justfile.js';
import type { EvalContext } from '../src/evaluator.js';

function ctx(vars?: Record<string, string>): EvalContext {
  return {
    scope: new Map(Object.entries(vars ?? {})),
    shell: ['sh', '-cu'],
  };
}

describe('Evaluator', () => {
  it('should evaluate string literal', () => {
    expect(evaluateExpression({ kind: 'string', value: 'hello' }, ctx())).toBe('hello');
  });

  it('should evaluate variable', () => {
    expect(evaluateExpression({ kind: 'variable', name: 'x' }, ctx({ x: 'world' }))).toBe('world');
  });

  it('should throw on undefined variable', () => {
    expect(() => evaluateExpression({ kind: 'variable', name: 'x' }, ctx())).toThrow();
  });

  it('should evaluate concat', () => {
    const expr = {
      kind: 'concat' as const,
      left: { kind: 'string' as const, value: 'hello ' },
      right: { kind: 'variable' as const, name: 'name' },
    };
    expect(evaluateExpression(expr, ctx({ name: 'world' }))).toBe('hello world');
  });

  it('should evaluate backtick', () => {
    expect(evaluateExpression({ kind: 'backtick', command: 'echo hi' }, ctx())).toBe('hi');
  });

  it('should evaluate all assignments', () => {
    const jf = parseJustfile('name := "world"\ngreeting := "hello"');
    const scope = evaluateAssignments(jf);
    expect(scope.get('name')).toBe('world');
    expect(scope.get('greeting')).toBe('hello');
  });

  it('should evaluate env_var_or_default', () => {
    const expr = {
      kind: 'call' as const,
      name: 'env_var_or_default',
      args: [
        { kind: 'string' as const, value: 'NONEXISTENT_VAR_12345' },
        { kind: 'string' as const, value: 'fallback' },
      ],
    };
    expect(evaluateExpression(expr, ctx())).toBe('fallback');
  });

  it('should evaluate arch()', () => {
    const result = evaluateExpression({ kind: 'call', name: 'arch', args: [] }, ctx());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should evaluate uppercase()', () => {
    const result = evaluateExpression(
      { kind: 'call', name: 'uppercase', args: [{ kind: 'string', value: 'hello' }] },
      ctx(),
    );
    expect(result).toBe('HELLO');
  });
});
