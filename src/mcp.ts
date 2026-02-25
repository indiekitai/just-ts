#!/usr/bin/env node

/**
 * MCP (Model Context Protocol) server for @indiekit/just.
 *
 * Exposes three tools:
 * - `list_recipes` — list all recipes in a justfile
 * - `run_recipe` — execute a recipe
 * - `parse_justfile` — parse a justfile and return the AST
 *
 * Start with: `npx @indiekit/just --mcp` or `just-run-mcp`
 * @module
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { findJustfile, loadJustfile, parseJustfile } from './justfile.js';
import { run } from './executor.js';
import { JustError } from './error.js';

const server = new McpServer({
  name: '@indiekit/just',
  version: '0.1.0',
});

server.tool(
  'list_recipes',
  'List all recipes defined in the justfile',
  {
    justfile: z.string().optional().describe('Path to justfile (auto-detected if omitted)'),
  },
  async ({ justfile: path }) => {
    try {
      const resolvedPath = path ?? findJustfile();
      const jf = loadJustfile(resolvedPath);
      const recipes = jf.recipes.map(r => ({
        name: r.name,
        doc: r.doc ?? null,
        params: r.params.map(p => ({
          name: p.name,
          default: !!p.default,
          variadic: p.variadic ?? null,
        })),
        deps: r.deps.map(d => d.recipe),
      }));
      return { content: [{ type: 'text' as const, text: JSON.stringify(recipes, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

server.tool(
  'run_recipe',
  'Execute a recipe from the justfile',
  {
    recipe: z.string().describe('Name of the recipe to run'),
    args: z.array(z.string()).optional().describe('Arguments to pass to the recipe'),
    justfile: z.string().optional().describe('Path to justfile (auto-detected if omitted)'),
    dryRun: z.boolean().optional().describe('Print commands without executing'),
  },
  async ({ recipe, args, justfile: path, dryRun }) => {
    try {
      const resolvedPath = path ?? findJustfile();
      const jf = loadJustfile(resolvedPath);
      await run({
        justfile: jf,
        recipe,
        args: args ?? [],
        dryRun: dryRun ?? false,
      });
      return { content: [{ type: 'text' as const, text: `Recipe '${recipe}' completed successfully.` }] };
    } catch (e: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

server.tool(
  'parse_justfile',
  'Parse justfile source text and return the AST as JSON',
  {
    source: z.string().optional().describe('Raw justfile source text (provide this OR path)'),
    path: z.string().optional().describe('Path to justfile to parse'),
  },
  async ({ source, path }) => {
    try {
      let ast;
      if (source) {
        ast = parseJustfile(source);
      } else {
        const resolvedPath = path ?? findJustfile();
        ast = loadJustfile(resolvedPath);
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(ast, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error('MCP server error:', e);
  process.exit(1);
});
