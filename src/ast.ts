/** AST node types for justfile */

export type Expression =
  | { kind: 'string'; value: string }
  | { kind: 'backtick'; command: string }
  | { kind: 'variable'; name: string }
  | { kind: 'concat'; left: Expression; right: Expression }
  | { kind: 'call'; name: string; args: Expression[] };

export interface Assignment {
  name: string;
  value: Expression;
  export: boolean;
  line: number;
}

export interface Parameter {
  name: string;
  default?: Expression;
  variadic?: 'plus' | 'star';
}

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

export interface Justfile {
  assignments: Assignment[];
  recipes: Recipe[];
  settings: Setting[];
}
