declare enum TokenKind {
    At = "At",
    Colon = "Colon",
    ColonEquals = "ColonEquals",
    Comma = "Comma",
    Equals = "Equals",
    ParenL = "ParenL",
    ParenR = "ParenR",
    Plus = "Plus",
    Star = "Star",
    Dollar = "Dollar",
    Identifier = "Identifier",
    StringLiteral = "StringLiteral",
    Backtick = "Backtick",
    Comment = "Comment",
    Indent = "Indent",
    Dedent = "Dedent",
    Eol = "Eol",
    Eof = "Eof",
    Whitespace = "Whitespace",
    Text = "Text",
    InterpolationStart = "InterpolationStart",
    InterpolationEnd = "InterpolationEnd"
}
interface Token {
    kind: TokenKind;
    value: string;
    line: number;
    column: number;
}
declare function lex(src: string): Token[];

/** AST node types for justfile */
type Expression = {
    kind: 'string';
    value: string;
} | {
    kind: 'backtick';
    command: string;
} | {
    kind: 'variable';
    name: string;
} | {
    kind: 'concat';
    left: Expression;
    right: Expression;
} | {
    kind: 'call';
    name: string;
    args: Expression[];
};
interface Assignment {
    name: string;
    value: Expression;
    export: boolean;
    line: number;
}
interface Parameter {
    name: string;
    default?: Expression;
    variadic?: 'plus' | 'star';
}
interface Dependency {
    recipe: string;
    args: Expression[];
}
/** A single line in a recipe body */
interface Line {
    fragments: Fragment[];
}
type Fragment = {
    kind: 'text';
    value: string;
} | {
    kind: 'interpolation';
    expression: Expression;
};
interface Recipe {
    name: string;
    doc?: string;
    quiet: boolean;
    params: Parameter[];
    deps: Dependency[];
    body: Line[];
    line: number;
}
interface Setting {
    name: string;
    value: string | string[] | boolean;
    line: number;
}
interface Justfile {
    assignments: Assignment[];
    recipes: Recipe[];
    settings: Setting[];
}

declare function parse(tokens: Token[]): Justfile;

interface EvalContext {
    scope: Map<string, string>;
    shell: [string, ...string[]];
    dryRun?: boolean;
}
/**
 * Evaluate all variable assignments and return the scope
 */
declare function evaluateAssignments(justfile: Justfile, overrides?: Record<string, string>): Map<string, string>;
/**
 * Evaluate a single expression to a string
 */
declare function evaluateExpression(expr: Expression, ctx: EvalContext): string;

interface RunOptions {
    justfile: Justfile;
    recipe?: string;
    args?: string[];
    dryRun?: boolean;
    overrides?: Record<string, string>;
}
declare function run(options: RunOptions): Promise<void>;

/**
 * Search for a justfile starting from `dir`, going up to root.
 */
declare function findJustfile(dir?: string): string;
/**
 * Load and parse a justfile from a path.
 */
declare function loadJustfile(path: string): Justfile;
/**
 * Parse justfile source text.
 */
declare function parseJustfile(src: string): Justfile;

declare class JustError extends Error {
    line?: number | undefined;
    column?: number | undefined;
    constructor(message: string, line?: number | undefined, column?: number | undefined);
}
declare class LexError extends JustError {
    constructor(message: string, line?: number, column?: number);
}
declare class ParseError extends JustError {
    constructor(message: string, line?: number, column?: number);
}
declare class RuntimeError extends JustError {
    constructor(message: string);
}

export { type Assignment, type Dependency, type EvalContext, type Expression, type Fragment, JustError, type Justfile, LexError, type Line, type Parameter, ParseError, type Recipe, type RunOptions, RuntimeError, type Setting, type Token, TokenKind, evaluateAssignments, evaluateExpression, findJustfile, lex, loadJustfile, parse, parseJustfile, run };
