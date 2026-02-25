import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { JustError } from './error.js';
import { lex } from './lexer.js';
import { parse } from './parser.js';
import type { Justfile } from './ast.js';

const JUSTFILE_NAMES = ['justfile', 'Justfile', '.justfile'];

/**
 * Search for a justfile starting from `dir`, going up to root.
 */
export function findJustfile(dir: string = process.cwd()): string {
  let current = resolve(dir);
  while (true) {
    for (const name of JUSTFILE_NAMES) {
      const path = resolve(current, name);
      try {
        readFileSync(path, 'utf-8');
        return path;
      } catch {}
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new JustError('No justfile found');
    }
    current = parent;
  }
}

/**
 * Load and parse a justfile from a path.
 */
export function loadJustfile(path: string): Justfile {
  const src = readFileSync(path, 'utf-8');
  return parseJustfile(src);
}

/**
 * Parse justfile source text.
 */
export function parseJustfile(src: string): Justfile {
  const tokens = lex(src);
  return parse(tokens);
}
