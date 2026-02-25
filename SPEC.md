# just-ts - A Command Runner for TypeScript/Node.js

## Overview
TypeScript port of casey/just (https://github.com/casey/just) - a command runner.
Reference code at /tmp/just/ (Rust, 22k lines - we port CORE features only)

## Scope - MVP
NOT a full port. Implement the most-used features:

### Must Have (MVP)
- Parse justfile syntax (recipes, variables, comments)
- Execute recipes with arguments
- Variable assignments and interpolation
- Default recipe (first one)
- Recipe dependencies
- `@` prefix for quiet execution
- String literals (single/double/backtick)
- `set shell` setting
- `--list` command
- `--dry-run`
- Error messages with line numbers

### Nice to Have (v2)
- Conditional expressions (if/else)
- Functions (env, arch, os, etc.)
- Recipe attributes ([private], [no-cd], etc.)
- Dotenv loading
- Export variables
- Recipe groups

### Out of Scope
- Shell completions
- Full Rust-level error handling
- All 50+ built-in functions

## Architecture
```
src/
  index.ts        - Public API
  lexer.ts        - Tokenizer (port from /tmp/just/src/lexer.rs)
  parser.ts       - Parser → AST (port from /tmp/just/src/parser.rs)
  ast.ts          - AST node types
  evaluator.ts    - Variable evaluation & interpolation
  executor.ts     - Recipe execution (spawn shell)
  justfile.ts     - Justfile loading & searching
  cli.ts          - CLI entry point
  error.ts        - Error types
```

## CLI
```bash
# Run default recipe
npx just-run

# Run specific recipe
npx just-run build

# With arguments
npx just-run deploy staging

# List recipes
npx just-run --list

# Dry run
npx just-run --dry-run build
```

## Justfile Syntax to Support
```justfile
# Variable assignment
name := "world"
port := "8080"

# Default recipe (first one)
default: build test

# Recipe with commands
build:
    echo "Building..."
    npm run build

# Recipe with arguments
greet who:
    echo "Hello {{who}}"

# Recipe with dependencies
test: build
    npm test

# Quiet recipe
@clean:
    rm -rf dist

# Backtick evaluation
git_hash := `git rev-parse --short HEAD`

# String interpolation in commands
deploy env:
    echo "Deploying {{name}} ({{git_hash}}) to {{env}}"
```

## Reference Files (most important)
- Lexer: /tmp/just/src/lexer.rs (2517 lines - KEY FILE)
- Parser: /tmp/just/src/parser.rs (3140 lines - KEY FILE)
- Evaluator: /tmp/just/src/evaluator.rs (627 lines)
- Recipe: /tmp/just/src/recipe.rs (621 lines)
- Justfile: /tmp/just/src/justfile.rs (1134 lines)

## Package Setup
- TypeScript with tsup
- vitest for testing
- package.json: "@indiekit/just"
- bin: "just-run"
- ESM + CJS
- Zero dependencies

## Testing
Write tests for:
- Lexer tokenization
- Parser (various justfile formats)
- Variable interpolation
- Recipe execution
- Error handling
- CLI flags

Create sample justfiles in test/fixtures/
