import { spawn } from 'node:child_process';
import { RuntimeError } from './error.js';
import { evaluateExpression, evaluateAssignments, getShell } from './evaluator.js';
import type { Justfile, Recipe, Line, Fragment, Expression } from './ast.js';
import type { EvalContext } from './evaluator.js';

export interface RunOptions {
  justfile: Justfile;
  recipe?: string;
  args?: string[];
  dryRun?: boolean;
  overrides?: Record<string, string>;
}

export async function run(options: RunOptions): Promise<void> {
  const { justfile, args = [], dryRun = false, overrides } = options;
  const recipeName = options.recipe ?? justfile.recipes[0]?.name;

  if (!recipeName) {
    throw new RuntimeError('No recipes defined');
  }

  const scope = evaluateAssignments(justfile, overrides);
  const shell = getShell(justfile);
  const ctx: EvalContext = { scope, shell, dryRun };

  const executed = new Set<string>();
  await executeRecipe(justfile, recipeName, args, ctx, executed);
}

async function executeRecipe(
  justfile: Justfile,
  name: string,
  args: string[],
  ctx: EvalContext,
  executed: Set<string>,
): Promise<void> {
  if (executed.has(name)) return;
  executed.add(name);

  const recipe = justfile.recipes.find(r => r.name === name);
  if (!recipe) {
    throw new RuntimeError(`Recipe '${name}' not found`);
  }

  // Bind parameters
  const recipeScope = new Map(ctx.scope);
  for (let i = 0; i < recipe.params.length; i++) {
    const param = recipe.params[i];
    if (param.variadic === 'plus') {
      const rest = args.slice(i);
      if (rest.length === 0) {
        throw new RuntimeError(`Recipe '${name}' requires at least one argument for '${param.name}'`);
      }
      recipeScope.set(param.name, rest.join(' '));
      break;
    } else if (param.variadic === 'star') {
      recipeScope.set(param.name, args.slice(i).join(' '));
      break;
    } else if (i < args.length) {
      recipeScope.set(param.name, args[i]);
    } else if (param.default) {
      recipeScope.set(param.name, evaluateExpression(param.default, ctx));
    } else {
      throw new RuntimeError(`Recipe '${name}' missing argument '${param.name}'`);
    }
  }

  const recipeCtx: EvalContext = { ...ctx, scope: recipeScope };

  // Execute dependencies first
  for (const dep of recipe.deps) {
    const depArgs = dep.args.map(a => evaluateExpression(a, recipeCtx));
    await executeRecipe(justfile, dep.recipe, depArgs, ctx, executed);
  }

  // Execute body lines
  for (const line of recipe.body) {
    const command = renderLine(line, recipeCtx);
    
    if (ctx.dryRun) {
      console.log(command);
      continue;
    }

    const quiet = recipe.quiet || command.startsWith('@');
    const cmd = command.startsWith('@') ? command.slice(1) : command;

    if (!quiet) {
      console.log(cmd);
    }

    await runCommand(cmd, ctx.shell);
  }
}

function renderLine(line: Line, ctx: EvalContext): string {
  return line.fragments.map(f => {
    if (f.kind === 'text') return f.value;
    return evaluateExpression(f.expression, ctx);
  }).join('');
}

async function runCommand(command: string, shell: [string, ...string[]]): Promise<void> {
  const [cmd, ...shellArgs] = shell;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...shellArgs, command], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new RuntimeError(`Recipe failed with exit code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', (err) => {
      reject(new RuntimeError(`Failed to execute command: ${err.message}`));
    });
  });
}
