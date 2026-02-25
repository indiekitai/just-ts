# @indiekit/just

[![npm version](https://img.shields.io/npm/v/@indiekit/just)](https://www.npmjs.com/package/@indiekit/just)
[![license](https://img.shields.io/npm/l/@indiekit/just)](./LICENSE)
[![tests](https://img.shields.io/github/actions/workflow/status/indiekitai/just/ci.yml?label=tests)](https://github.com/indiekitai/just/actions)

A TypeScript port of [casey/just](https://github.com/casey/just) — the command runner. Run it anywhere Node.js runs, no compiled binary needed.

```bash
npx @indiekit/just build
```

## Why TypeScript?

| | Rust `just` | `@indiekit/just` |
|---|---|---|
| Install | Homebrew / cargo / binary download | `npx` — zero install |
| Portability | Needs compiled binary per platform | Runs anywhere Node.js runs |
| Programmatic use | N/A | Full API: `import { parseJustfile } from '@indiekit/just'` |
| MCP server | N/A | Built-in — AI agents can list & run recipes |
| Agent-friendly | Text output only | `--json`, `--dump`, clear exit codes |

If you already have `just` installed and don't need programmatic access, use the Rust version — it's faster. This port is for when you want **zero-install convenience**, **programmatic access**, or **AI agent integration**.

## Install

```bash
# Run directly (no install needed)
npx @indiekit/just

# Or install globally
npm install -g @indiekit/just
```

## CLI Usage

```bash
just-run                     # Run the default (first) recipe
just-run build               # Run the 'build' recipe
just-run test arg1 arg2      # Run 'test' with arguments
just-run --list              # List all recipes
just-run --list --json       # List recipes as JSON
just-run --dump              # Output parsed AST as JSON
just-run --dry-run build     # Print commands without executing
just-run -f path/justfile    # Use a specific justfile
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Recipe execution failed |
| 2 | Parse error (invalid justfile syntax) |
| 3 | Justfile not found |

### JSON Output

Use `--json` for structured output (useful for scripts and AI agents):

```bash
just-run --list --json
# {"recipes":[{"name":"build","doc":null,"params":[],"deps":[],"quiet":false}]}

just-run build --json
# {"status":"ok"}
```

Use `--dump` to get the full parsed AST:

```bash
just-run --dump
# { "assignments": [...], "recipes": [...], "settings": [...] }
```

## Justfile Syntax Guide

### Recipes

```just
# A comment describing the recipe
build:
    cargo build --release

# Recipe with dependencies
all: clean build test
```

### Variables

```just
version := "1.0.0"
target  := "release"

build:
    echo "Building {{version}} in {{target}} mode"
```

### Parameters

```just
# Positional parameter
greet name:
    echo "Hello, {{name}}!"

# Default value
serve port="8080":
    python -m http.server {{port}}

# Variadic (one or more)
test +files:
    cargo test {{files}}

# Variadic (zero or more)
lint *flags:
    eslint {{flags}} src/
```

### Dependencies

```just
build: clean compile
    echo "Done!"

clean:
    rm -rf dist/

compile:
    tsc
```

### Strings

```just
# Double-quoted (supports escape sequences: \n, \t, \\, \")
msg := "Hello\nWorld"

# Single-quoted (raw, no escapes)
path := 'C:\Users\name'

# Triple-quoted (multi-line)
script := """
    #!/bin/bash
    echo "hello"
"""
```

### Interpolation

```just
version := "1.0.0"

build:
    echo "Building version {{version}}"
```

### Backtick Substitution

```just
git_hash := `git rev-parse --short HEAD`
date     := `date +%Y-%m-%d`

info:
    echo "Commit {{git_hash}} on {{date}}"
```

### Settings

```just
set shell := ["bash", "-cu"]
```

### Built-in Functions

| Function | Description |
|----------|-------------|
| `arch()` | CPU architecture (`x86_64`, `aarch64`) |
| `os()` | Operating system (`linux`, `macos`, `windows`) |
| `os_family()` | OS family (`unix`, `windows`) |
| `env_var(name)` | Get environment variable (error if unset) |
| `env_var_or_default(name, default)` | Get env var with fallback |
| `uppercase(s)` | Convert to uppercase |
| `lowercase(s)` | Convert to lowercase |
| `trim(s)` | Trim whitespace |
| `replace(s, from, to)` | String replacement |

### Quiet Recipes

```just
# Prefix with @ to suppress command echoing
@deploy:
    rsync -avz dist/ server:/var/www/
```

### Export Variables

```just
export DATABASE_URL := "postgres://localhost/mydb"

migrate:
    diesel migration run
```

## Programmatic API

```typescript
import {
  findJustfile,
  loadJustfile,
  parseJustfile,
  run,
  lex,
  parse,
} from '@indiekit/just';

// Parse and run
const path = findJustfile();
const justfile = loadJustfile(path);
await run({ justfile, recipe: 'build', args: ['--release'] });

// Parse from string
const ast = parseJustfile(`
build:
    echo "hello"
`);
console.log(ast.recipes[0].name); // "build"

// Low-level: tokenize then parse
const tokens = lex(source);
const justfile2 = parse(tokens);
```

### Exported Types

All AST types are exported for programmatic use:

```typescript
import type {
  Justfile, Recipe, Assignment, Expression,
  Parameter, Dependency, Line, Fragment, Setting,
  Token, EvalContext, RunOptions,
} from '@indiekit/just';
```

## MCP Server

Built-in [Model Context Protocol](https://modelcontextprotocol.io) server for AI agent integration.

```bash
# Start the MCP server
just-run-mcp
```

### Available Tools

| Tool | Description |
|------|-------------|
| `list_recipes` | List all recipes with parameters and docs |
| `run_recipe` | Execute a recipe by name with arguments |
| `parse_justfile` | Parse justfile source or file and return AST |

### MCP Configuration

Add to your MCP client config (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "just": {
      "command": "npx",
      "args": ["@indiekit/just-mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "just": {
      "command": "just-run-mcp"
    }
  }
}
```

## Compatibility with Rust `just`

### ✅ Supported

- Recipes with bodies, parameters, dependencies
- Variable assignments (`:=`) and exports
- String literals (single, double, triple-quoted)
- Escape sequences in double-quoted strings
- Backtick substitution (single and triple)
- `{{ }}` interpolation in recipe bodies
- `@` quiet recipes
- Variadic parameters (`+` and `*`)
- Settings (`set shell`, etc.)
- Built-in functions (`arch`, `os`, `env_var`, `uppercase`, etc.)
- Doc comments (comment above recipe)
- `--list`, `--dry-run` flags

### ❌ Not Yet Supported

- `[attributes]` (e.g., `[no-cd]`, `[private]`, `[linux]`)
- Conditional expressions (`if ... { } else { }`)
- `import` and `mod` statements
- `[confirm]` attribute
- Error/regex functions (`error()`, `regex_replace()`)
- Path functions (`join()`, `parent_directory()`, etc.)
- Shell function (`shell()`)
- `{{{{` escape (literal `{{` in body)
- `[no-exit-message]`, `[group]`, and other attributes
- `set dotenv-load`, `set positional-arguments`

## License

MIT
