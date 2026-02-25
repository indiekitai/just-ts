/**
 * @indiekit/just — A TypeScript port of casey/just command runner.
 *
 * @example
 * ```ts
 * import { findJustfile, loadJustfile, run } from '@indiekit/just';
 *
 * const path = findJustfile();
 * const justfile = loadJustfile(path);
 * await run({ justfile, recipe: 'build' });
 * ```
 * @module
 */

// Lexer
export { lex, TokenKind } from './lexer.js';
export type { Token } from './lexer.js';

// Parser
export { parse } from './parser.js';

// Evaluator
export { evaluateExpression, evaluateAssignments } from './evaluator.js';
export type { EvalContext } from './evaluator.js';

// Executor
export { run } from './executor.js';
export type { RunOptions } from './executor.js';

// High-level API
export { findJustfile, loadJustfile, parseJustfile } from './justfile.js';

// Errors
export { JustError, LexError, ParseError, RuntimeError } from './error.js';

// AST types
export type {
  Justfile, Recipe, Assignment, Expression, Parameter,
  Dependency, Line, Fragment, Setting,
} from './ast.js';
