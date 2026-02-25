import { describe, it, expect } from 'vitest';
import { parseJustfile } from '../src/justfile.js';

describe('Parser', () => {
  it('should parse variable assignment', () => {
    const jf = parseJustfile('name := "hello"');
    expect(jf.assignments).toHaveLength(1);
    expect(jf.assignments[0].name).toBe('name');
    expect(jf.assignments[0].value).toEqual({ kind: 'string', value: 'hello' });
  });

  it('should parse backtick assignment', () => {
    const jf = parseJustfile('hash := `git rev-parse HEAD`');
    expect(jf.assignments[0].value).toEqual({ kind: 'backtick', command: 'git rev-parse HEAD' });
  });

  it('should parse concat expression', () => {
    const jf = parseJustfile('x := "hello" + " " + "world"');
    expect(jf.assignments[0].value.kind).toBe('concat');
  });

  it('should parse simple recipe', () => {
    const jf = parseJustfile('build:\n    echo hello\n');
    expect(jf.recipes).toHaveLength(1);
    expect(jf.recipes[0].name).toBe('build');
    expect(jf.recipes[0].body).toHaveLength(1);
    expect(jf.recipes[0].body[0].fragments[0]).toEqual({ kind: 'text', value: 'echo hello' });
  });

  it('should parse recipe with parameters', () => {
    const jf = parseJustfile('greet who:\n    echo {{who}}\n');
    expect(jf.recipes[0].params).toHaveLength(1);
    expect(jf.recipes[0].params[0].name).toBe('who');
  });

  it('should parse recipe with dependencies', () => {
    const jf = parseJustfile('test: build\n    npm test\n');
    expect(jf.recipes[0].deps).toHaveLength(1);
    expect(jf.recipes[0].deps[0].recipe).toBe('build');
  });

  it('should parse quiet recipe', () => {
    const jf = parseJustfile('@clean:\n    rm -rf dist\n');
    expect(jf.recipes[0].quiet).toBe(true);
  });

  it('should parse recipe with interpolation', () => {
    const jf = parseJustfile('greet who:\n    echo "Hello {{who}}"\n');
    const frags = jf.recipes[0].body[0].fragments;
    expect(frags.some(f => f.kind === 'interpolation')).toBe(true);
  });

  it('should parse multiple recipes', () => {
    const src = `build:
    echo building

test: build
    echo testing
`;
    const jf = parseJustfile(src);
    expect(jf.recipes).toHaveLength(2);
    expect(jf.recipes[0].name).toBe('build');
    expect(jf.recipes[1].name).toBe('test');
  });

  it('should parse recipe with default parameter', () => {
    const jf = parseJustfile('serve port="8080":\n    echo {{port}}\n');
    expect(jf.recipes[0].params[0].default).toEqual({ kind: 'string', value: '8080' });
  });

  it('should parse export assignment', () => {
    const jf = parseJustfile('export FOO := "bar"');
    expect(jf.assignments[0].export).toBe(true);
  });

  it('should parse variable reference in assignment', () => {
    const jf = parseJustfile('name := "world"\ngreeting := "hello " + name');
    expect(jf.assignments).toHaveLength(2);
    expect(jf.assignments[1].value.kind).toBe('concat');
  });

  it('should parse comments between recipes', () => {
    const src = `# Build the project
build:
    echo building
`;
    const jf = parseJustfile(src);
    expect(jf.recipes[0].name).toBe('build');
    expect(jf.recipes[0].doc).toBe('Build the project');
  });

  it('should parse complex justfile', () => {
    const src = `# My project
name := "myapp"
version := "1.0"

# Build recipe
build:
    echo "Building {{name}} v{{version}}"

# Test recipe
test: build
    echo "Testing..."

# Deploy
deploy env:
    echo "Deploying to {{env}}"
`;
    const jf = parseJustfile(src);
    expect(jf.assignments).toHaveLength(2);
    expect(jf.recipes).toHaveLength(3);
    expect(jf.recipes[2].params[0].name).toBe('env');
  });
});
