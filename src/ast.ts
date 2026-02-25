/**
 * AST node types for justfile.
 *
 * These types represent the parsed structure of a justfile and can be
 * used for programmatic analysis, transformation, or code generation.
 * @module
 */

/** An expression that evaluates to a string value. */
export type Expression =
  | { kind: 'string'; value: string }
  | { kind: 'backtick'; command: string }
  | { kind: 'variable'; name: string }
  | { kind: 'concat'; left: Expression; right: Expression }
  | { kind: 'call'; name: string; args: Expression[] };

/** A variable assignment (e.g., `name := "value"`). */
export interface Assignment {
  name: string;
  value: Expression;
  export: boolean;
  line: number;
}

/** A recipe parameter with optional default value and variadic modifier. */
export interface Parameter {
  name: string;
  default?: Expression;
  variadic?: 'plus' | 'star';
}

/** A recipe dependency reference. */
export interface Dependency {
  recipe: string;
  args: Expression[];
}

/** A single line in a recipe body */
export interface Line {
  fragments: Fragment[];
}

export type Fragment =
  | { kind: 'text'; value: string }
  | { kind: 'interpolation'; expression: Expression };

/** A recipe definition with parameters, dependencies, and body lines. */
export interface Recipe {
  name: string;
  doc?: string;
  quiet: boolean;
  params: Parameter[];
  deps: Dependency[];
  body: Line[];
  line: number;
}

export interface Setting {
  name: string;
  value: string | string[] | boolean;
  line: number;
}

/** The top-level AST node representing a parsed justfile. */
export interface Justfile {
  assignments: Assignment[];
  recipes: Recipe[];
  settings: Setting[];
}
