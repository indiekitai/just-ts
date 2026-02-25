import { execSync } from 'node:child_process';
import { RuntimeError } from './error.js';
import type { Expression, Justfile, Assignment } from './ast.js';

export interface EvalContext {
  scope: Map<string, string>;
  shell: [string, ...string[]];
  dryRun?: boolean;
}

/**
 * Evaluate all variable assignments and return the scope
 */
export function evaluateAssignments(
  justfile: Justfile,
  overrides?: Record<string, string>
): Map<string, string> {
  const shell = getShell(justfile);
  const scope = new Map<string, string>();

  // Apply overrides first
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      scope.set(k, v);
    }
  }

  for (const assignment of justfile.assignments) {
    // Don't override user-provided values
    if (scope.has(assignment.name)) continue;
    const value = evaluateExpression(assignment.value, { scope, shell });
    scope.set(assignment.name, value);
  }

  return scope;
}

export function getShell(justfile: Justfile): [string, ...string[]] {
  const shellSetting = justfile.settings.find(s => s.name === 'shell');
  if (shellSetting) {
    const val = shellSetting.value;
    if (Array.isArray(val) && val.length > 0) {
      return val as [string, ...string[]];
    }
    if (typeof val === 'string') {
      return [val, '-c'];
    }
  }
  return ['sh', '-cu'];
}

/**
 * Evaluate a single expression to a string
 */
export function evaluateExpression(expr: Expression, ctx: EvalContext): string {
  switch (expr.kind) {
    case 'string':
      return expr.value;

    case 'variable': {
      const val = ctx.scope.get(expr.name);
      if (val === undefined) {
        throw new RuntimeError(`Variable '${expr.name}' not defined`);
      }
      return val;
    }

    case 'backtick': {
      if (ctx.dryRun) return `\`${expr.command}\``;
      try {
        const [cmd, ...args] = ctx.shell;
        return execSync(`${cmd} ${args.map(a => `'${a}'`).join(' ')} '${expr.command.replace(/'/g, "'\\''")}'`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).replace(/\n$/, '');
      } catch (e: any) {
        throw new RuntimeError(`Backtick failed: ${e.message}`);
      }
    }

    case 'concat':
      return evaluateExpression(expr.left, ctx) + evaluateExpression(expr.right, ctx);

    case 'call':
      return evaluateCall(expr.name, expr.args.map(a => evaluateExpression(a, ctx)));

    default:
      throw new RuntimeError(`Unknown expression kind: ${(expr as any).kind}`);
  }
}

function evaluateCall(name: string, args: string[]): string {
  // Minimal built-in functions
  switch (name) {
    case 'env_var':
      if (args.length !== 1) throw new RuntimeError(`env_var() takes 1 argument`);
      const val = process.env[args[0]];
      if (val === undefined) throw new RuntimeError(`Environment variable '${args[0]}' not set`);
      return val;

    case 'env_var_or_default':
      if (args.length !== 2) throw new RuntimeError(`env_var_or_default() takes 2 arguments`);
      return process.env[args[0]] ?? args[1];

    case 'arch':
      return process.arch === 'x64' ? 'x86_64' : process.arch === 'arm64' ? 'aarch64' : process.arch;

    case 'os':
      return process.platform === 'darwin' ? 'macos' : process.platform;

    case 'os_family':
      return process.platform === 'win32' ? 'windows' : 'unix';

    case 'uppercase':
      return args[0]?.toUpperCase() ?? '';

    case 'lowercase':
      return args[0]?.toLowerCase() ?? '';

    case 'trim':
      return args[0]?.trim() ?? '';

    case 'replace':
      if (args.length !== 3) throw new RuntimeError(`replace() takes 3 arguments`);
      return args[0].split(args[1]).join(args[2]);

    default:
      throw new RuntimeError(`Unknown function: ${name}()`);
  }
}
