# @indiekit/just

A command runner for TypeScript/Node.js — a TypeScript port of [casey/just](https://github.com/casey/just).

## Features

- **Parse justfile syntax** — recipes, variables, comments, string literals
- **Execute recipes** with arguments and dependencies
- **Variable assignments** and interpolation
- **`@` prefix** for quiet execution
- **`set shell`** setting support
- **`--list`** to show available recipes
- **`--dry-run`** to preview commands
- **MCP Server** — expose justfile recipes to AI agents
- **Error messages** with line numbers

## Install

```bash
npm install @indiekit/just
```

## CLI Usage

```bash
# Run the default recipe (first one)
just-run

# Run a specific recipe
just-run build

# Run with arguments
just-run deploy production

# List all recipes
just-run --list

# Dry run
just-run --dry-run build
```

## Justfile Example

```justfile
# Build the project
build:
    npm run build

# Deploy to environment
deploy env:
    echo "Deploying to {{env}}"
    ./scripts/deploy.sh {{env}}

# Run tests (depends on build)
test: build
    npm test
```

## MCP Server

Expose justfile recipes as AI-agent tools:

```bash
just-run-mcp
```

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "just": {
      "command": "just-run-mcp"
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `list_recipes` | List all recipes in a justfile |
| `run_recipe` | Execute a recipe |
| `parse_justfile` | Parse and return justfile AST |

## API Usage

```typescript
import { parseJustfile, execute } from '@indiekit/just';

const justfile = parseJustfile('justfile');
await execute(justfile, 'build');
```

## License

MIT
