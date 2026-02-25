import { describe, it, expect } from 'vitest';
import { parseJustfile } from '../src/justfile.js';
import { run } from '../src/executor.js';

describe('Executor', () => {
  it('should run simple recipe', async () => {
    const jf = parseJustfile('build:\n    echo hello\n');
    // Just verify it doesn't throw
    await run({ justfile: jf, recipe: 'build' });
  });

  it('should throw on missing recipe', async () => {
    const jf = parseJustfile('build:\n    echo hello\n');
    await expect(run({ justfile: jf, recipe: 'nonexistent' })).rejects.toThrow('not found');
  });

  it('should run default recipe (first one)', async () => {
    const jf = parseJustfile('default:\n    echo default\n');
    await run({ justfile: jf });
  });

  it('should handle dry run', async () => {
    const jf = parseJustfile('build:\n    echo hello\n');
    await run({ justfile: jf, recipe: 'build', dryRun: true });
  });

  it('should throw on missing required argument', async () => {
    const jf = parseJustfile('greet who:\n    echo {{who}}\n');
    await expect(run({ justfile: jf, recipe: 'greet', args: [] })).rejects.toThrow('missing argument');
  });

  it('should pass arguments to recipe', async () => {
    const jf = parseJustfile('greet who:\n    echo {{who}}\n');
    await run({ justfile: jf, recipe: 'greet', args: ['world'] });
  });

  it('should run dependencies before recipe', async () => {
    const src = `a:
    echo a

b: a
    echo b
`;
    const jf = parseJustfile(src);
    await run({ justfile: jf, recipe: 'b' });
  });

  it('should throw on no recipes', async () => {
    const jf = parseJustfile('x := "hello"');
    await expect(run({ justfile: jf })).rejects.toThrow('No recipes');
  });
});
