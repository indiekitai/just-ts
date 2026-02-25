export class JustError extends Error {
  constructor(message: string, public line?: number, public column?: number) {
    super(message);
    this.name = 'JustError';
  }
}

export class LexError extends JustError {
  constructor(message: string, line?: number, column?: number) {
    super(message, line, column);
    this.name = 'LexError';
  }
}

export class ParseError extends JustError {
  constructor(message: string, line?: number, column?: number) {
    super(message, line, column);
    this.name = 'ParseError';
  }
}

export class RuntimeError extends JustError {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeError';
  }
}
