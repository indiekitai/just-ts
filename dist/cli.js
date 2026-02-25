#!/usr/bin/env node
import {
  JustError,
  findJustfile,
  loadJustfile,
  run
} from "./chunk-WC4PM3A2.js";

// src/cli.ts
async function main() {
  const argv = process.argv.slice(2);
  let dryRun = false;
  let list = false;
  let justfilePath;
  const positional = [];
  const overrides = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--list" || arg === "-l") {
      list = true;
    } else if (arg === "--dry-run" || arg === "-n") {
      dryRun = true;
    } else if (arg === "--justfile" || arg === "-f") {
      justfilePath = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--version" || arg === "-V") {
      console.log("just-run 0.1.0");
      process.exit(0);
    } else if (arg.includes(":=")) {
      const [k, v] = arg.split(":=", 2);
      overrides[k] = v;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }
  try {
    const path = justfilePath ?? findJustfile();
    const justfile = loadJustfile(path);
    if (list) {
      printList(justfile);
      return;
    }
    const recipeName = positional[0];
    const args = positional.slice(1);
    await run({
      justfile,
      recipe: recipeName,
      args,
      dryRun,
      overrides
    });
  } catch (e) {
    if (e instanceof JustError) {
      console.error(`error: ${e.message}`);
      if (e.line !== void 0) {
        console.error(`  --> line ${e.line + 1}`);
      }
      process.exit(1);
    }
    throw e;
  }
}
function printList(justfile) {
  console.log("Available recipes:");
  for (const recipe of justfile.recipes) {
    let line = `    ${recipe.name}`;
    if (recipe.params.length > 0) {
      const params = recipe.params.map((p) => {
        let s = p.name;
        if (p.variadic === "plus") s = "+" + s;
        if (p.variadic === "star") s = "*" + s;
        if (p.default) s += `='...'`;
        return s;
      }).join(" ");
      line += ` ${params}`;
    }
    if (recipe.doc) {
      line += ` # ${recipe.doc}`;
    }
    console.log(line);
  }
}
function printUsage() {
  console.log(`just-run - A command runner

USAGE:
    just-run [OPTIONS] [RECIPE] [ARGS...]

OPTIONS:
    -f, --justfile <PATH>    Use specified justfile
    -l, --list               List available recipes
    -n, --dry-run            Print commands without executing
    -h, --help               Show this help
    -V, --version            Show version`);
}
main();
