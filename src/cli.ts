#!/usr/bin/env node

import { findJustfile, loadJustfile, parseJustfile } from './justfile.js';
import { run } from './executor.js';
import { JustError, LexError, ParseError } from './error.js';

/** Exit codes for machine consumption */
export const EXIT_SUCCESS = 0;
export const EXIT_RECIPE_FAILED = 1;
export const EXIT_PARSE_ERROR = 2;
export const EXIT_FILE_NOT_FOUND = 3;

async function main() {
  const argv = process.argv.slice(2);

  let dryRun = false;
  let list = false;
  let json = false;
  let dump = false;
  let justfilePath: string | undefined;
  const positional: string[] = [];
  const overrides: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list' || arg === '-l') {
      list = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      dryRun = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--dump') {
      dump = true;
    } else if (arg === '--justfile' || arg === '-f') {
      justfilePath = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(EXIT_SUCCESS);
    } else if (arg === '--version' || arg === '-V') {
      console.log('just-run 0.1.0');
      process.exit(EXIT_SUCCESS);
    } else if (arg.includes(':=')) {
      const [k, v] = arg.split(':=', 2);
      overrides[k] = v;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  try {
    let path: string;
    try {
      path = justfilePath ?? findJustfile();
    } catch {
      if (json) {
        console.log(JSON.stringify({ error: 'No justfile found' }));
      } else {
        console.error('error: No justfile found');
      }
      process.exit(EXIT_FILE_NOT_FOUND);
    }

    const justfile = loadJustfile(path);

    if (dump) {
      console.log(JSON.stringify(justfile, null, 2));
      return;
    }

    if (list) {
      if (json) {
        const recipes = justfile.recipes.map(r => ({
          name: r.name,
          doc: r.doc ?? null,
          params: r.params.map(p => ({
            name: p.name,
            default: p.default ? true : false,
            variadic: p.variadic ?? null,
          })),
          deps: r.deps.map(d => d.recipe),
          quiet: r.quiet,
        }));
        console.log(JSON.stringify({ recipes }));
      } else {
        printList(justfile);
      }
      return;
    }

    const recipeName = positional[0];
    const args = positional.slice(1);

    await run({
      justfile,
      recipe: recipeName,
      args,
      dryRun,
      overrides,
    });

    if (json) {
      console.log(JSON.stringify({ status: 'ok' }));
    }
  } catch (e: any) {
    if (e instanceof LexError || e instanceof ParseError) {
      if (json) {
        console.log(JSON.stringify({ error: e.message, line: e.line, column: e.column }));
      } else {
        console.error(`error: ${e.message}`);
        if (e.line !== undefined) {
          console.error(`  --> line ${e.line + 1}`);
        }
      }
      process.exit(EXIT_PARSE_ERROR);
    }
    if (e instanceof JustError) {
      if (json) {
        console.log(JSON.stringify({ error: e.message }));
      } else {
        console.error(`error: ${e.message}`);
        if (e.line !== undefined) {
          console.error(`  --> line ${e.line + 1}`);
        }
      }
      process.exit(EXIT_RECIPE_FAILED);
    }
    throw e;
  }
}

function printList(justfile: any) {
  console.log('Available recipes:');
  for (const recipe of justfile.recipes) {
    let line = `    ${recipe.name}`;
    if (recipe.params.length > 0) {
      const params = recipe.params.map((p: any) => {
        let s = p.name;
        if (p.variadic === 'plus') s = '+' + s;
        if (p.variadic === 'star') s = '*' + s;
        if (p.default) s += `='...'`;
        return s;
      }).join(' ');
      line += ` ${params}`;
    }
    if (recipe.doc) {
      line += ` # ${recipe.doc}`;
    }
    console.log(line);
  }
}

function printUsage() {
  console.log(`just-run - A TypeScript command runner (port of casey/just)

USAGE:
    just-run [OPTIONS] [RECIPE] [ARGS...]

OPTIONS:
    -f, --justfile <PATH>    Use specified justfile
    -l, --list               List available recipes
    -n, --dry-run            Print commands without executing
        --json               Output in JSON format (for scripting/agents)
        --dump               Parse justfile and output AST as JSON
    -h, --help               Show this help
    -V, --version            Show version

EXAMPLES:
    just-run                 Run the default (first) recipe
    just-run build           Run the 'build' recipe
    just-run test --json     Run 'test' with JSON output
    just-run --list --json   List recipes as JSON
    just-run --dump          Dump parsed AST

EXIT CODES:
    0  Success
    1  Recipe execution failed
    2  Parse error (invalid justfile syntax)
    3  Justfile not found`);
}

main();
