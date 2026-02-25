import { LexError } from './error.js';

export enum TokenKind {
  // Symbols
  At = 'At',
  Colon = 'Colon',
  ColonEquals = 'ColonEquals',
  Comma = 'Comma',
  Equals = 'Equals',
  ParenL = 'ParenL',
  ParenR = 'ParenR',
  Plus = 'Plus',
  Star = 'Star',
  Dollar = 'Dollar',

  // Literals
  Identifier = 'Identifier',
  StringLiteral = 'StringLiteral',
  Backtick = 'Backtick',
  Comment = 'Comment',

  // Structure
  Indent = 'Indent',
  Dedent = 'Dedent',
  Eol = 'Eol',
  Eof = 'Eof',
  Whitespace = 'Whitespace',

  // Body
  Text = 'Text',
  InterpolationStart = 'InterpolationStart',
  InterpolationEnd = 'InterpolationEnd',
}

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  column: number;
}

export function lex(src: string): Token[] {
  return new Lexer(src).tokenize();
}

class Lexer {
  private pos = 0;
  private line = 0;
  private column = 0;
  private tokens: Token[] = [];
  private indentStack: string[] = [''];
  private recipeBody = false;
  private recipeBodyPending = false;
  private interpolationDepth = 0;

  constructor(private src: string) {}

  private get ch(): string | undefined {
    return this.src[this.pos];
  }

  private peek(offset = 1): string | undefined {
    return this.src[this.pos + offset];
  }

  private advance(): string | undefined {
    const c = this.src[this.pos];
    this.pos++;
    if (c === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    return c;
  }

  private emit(kind: TokenKind, value: string, line: number, column: number) {
    this.tokens.push({ kind, value, line, column });
  }

  private error(msg: string): never {
    throw new LexError(msg, this.line, this.column);
  }

  tokenize(): Token[] {
    while (this.pos < this.src.length) {
      if (this.column === 0) {
        this.lexLineStart();
      }
      if (this.pos >= this.src.length) break;

      if (this.interpolationDepth > 0) {
        this.lexInterpolation();
      } else if (this.recipeBody) {
        this.lexBody();
      } else {
        this.lexNormal();
      }
    }

    // Close any remaining indentation
    while (this.indentStack.length > 1) {
      this.emit(TokenKind.Dedent, '', this.line, this.column);
      this.indentStack.pop();
      this.recipeBody = false;
      this.recipeBodyPending = false;
    }

    this.emit(TokenKind.Eof, '', this.line, this.column);
    return this.tokens;
  }

  private lexLineStart() {
    // Collect leading whitespace
    const startPos = this.pos;
    while (this.pos < this.src.length && (this.ch === ' ' || this.ch === '\t')) {
      this.advance();
    }
    const whitespace = this.src.slice(startPos, this.pos);

    // Blank line or EOF
    if (this.ch === '\n' || this.ch === '\r' || this.pos >= this.src.length) {
      return; // skip blank line indentation
    }

    // Comment at start of line - don't track indentation changes
    if (this.ch === '#' && !this.recipeBody) {
      return;
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];

    if (this.recipeBody || this.recipeBodyPending) {
      if (whitespace.length > currentIndent.length && whitespace.startsWith(currentIndent)) {
        // Inside recipe body - first indented line sets the indent level
        if (this.recipeBodyPending && !this.recipeBody) {
          this.indentStack.push(whitespace);
          this.emit(TokenKind.Indent, whitespace, this.line, 0);
          this.recipeBody = true;
          this.recipeBodyPending = false;
        }
        // Continue in body
        return;
      } else if (whitespace === currentIndent && this.recipeBody) {
        // Same indentation - still in body
        return;
      } else {
        // Dedent - leaving recipe body
        if (this.recipeBody) {
          this.emit(TokenKind.Dedent, '', this.line, 0);
          this.indentStack.pop();
          this.recipeBody = false;
          this.recipeBodyPending = false;
        } else {
          // pending but never got body
          this.recipeBodyPending = false;
        }
      }
    }
  }

  private lexNormal() {
    const c = this.ch!;
    const line = this.line;
    const col = this.column;

    switch (c) {
      case ' ':
      case '\t': {
        const start = this.pos;
        while (this.pos < this.src.length && (this.ch === ' ' || this.ch === '\t')) {
          this.advance();
        }
        this.emit(TokenKind.Whitespace, this.src.slice(start, this.pos), line, col);
        break;
      }
      case '\n': {
        this.advance();
        this.emit(TokenKind.Eol, '\n', line, col);
        break;
      }
      case '\r': {
        this.advance();
        if (this.ch === '\n') this.advance();
        this.emit(TokenKind.Eol, '\n', line, col);
        break;
      }
      case '#': {
        const start = this.pos;
        while (this.pos < this.src.length && this.ch !== '\n') {
          this.advance();
        }
        this.emit(TokenKind.Comment, this.src.slice(start, this.pos), line, col);
        break;
      }
      case ':': {
        this.advance();
        if (this.ch === '=') {
          this.advance();
          this.emit(TokenKind.ColonEquals, ':=', line, col);
        } else {
          this.emit(TokenKind.Colon, ':', line, col);
          // After a colon (recipe header), next indented block is a body
          this.recipeBodyPending = true;
        }
        break;
      }
      case '=': {
        this.advance();
        this.emit(TokenKind.Equals, '=', line, col);
        break;
      }
      case '@': {
        this.advance();
        this.emit(TokenKind.At, '@', line, col);
        break;
      }
      case '+': {
        this.advance();
        this.emit(TokenKind.Plus, '+', line, col);
        break;
      }
      case '*': {
        this.advance();
        this.emit(TokenKind.Star, '*', line, col);
        break;
      }
      case '$': {
        this.advance();
        this.emit(TokenKind.Dollar, '$', line, col);
        break;
      }
      case ',': {
        this.advance();
        this.emit(TokenKind.Comma, ',', line, col);
        break;
      }
      case '(': {
        this.advance();
        this.emit(TokenKind.ParenL, '(', line, col);
        break;
      }
      case ')': {
        this.advance();
        this.emit(TokenKind.ParenR, ')', line, col);
        break;
      }
      case '`': {
        this.lexBacktick();
        break;
      }
      case '"': {
        this.lexDoubleString();
        break;
      }
      case '\'': {
        this.lexSingleString();
        break;
      }
      default: {
        if (isIdentStart(c)) {
          this.lexIdentifier();
        } else {
          this.error(`Unexpected character: '${c}'`);
        }
      }
    }
  }

  private lexBody() {
    const line = this.line;
    const col = this.column;
    let text = '';
    const startPos = this.pos;

    // Consume leading indentation (skip the recipe indent level)
    const indent = this.indentStack[this.indentStack.length - 1];
    // We're at column 0 if we just handled lineStart, the indent was already consumed
    // Actually we need to check if we're at start of a line in the body
    
    while (this.pos < this.src.length) {
      // Check for interpolation {{ }}
      if (this.ch === '{' && this.peek() === '{') {
        // Emit accumulated text
        if (text.length > 0) {
          this.emit(TokenKind.Text, text, line, col);
          text = '';
        }
        const iLine = this.line;
        const iCol = this.column;
        this.advance(); // {
        this.advance(); // {
        // Check for escape {{{{ -> literal {{
        if (this.ch === '{' && this.peek() === '{') {
          this.advance();
          this.advance();
          text += '{{';
          continue;
        }
        this.emit(TokenKind.InterpolationStart, '{{', iLine, iCol);
        this.interpolationDepth++;
        return;
      }

      if (this.ch === '\n') {
        // Emit text before newline
        if (text.length > 0) {
          this.emit(TokenKind.Text, text, line, col);
          text = '';
        }
        const nlLine = this.line;
        const nlCol = this.column;
        this.advance();
        this.emit(TokenKind.Eol, '\n', nlLine, nlCol);
        
        // Check if next line continues the body
        const nextLineStart = this.pos;
        let ws = '';
        while (this.pos < this.src.length && ((this.ch as string) === ' ' || (this.ch as string) === '\t')) {
          ws += this.advance();
        }
        
        // Blank line in body
        const nextCh = this.ch as string | undefined;
        if (this.pos >= this.src.length || nextCh === '\n' || nextCh === '\r') {
          continue;
        }

        const bodyIndent = this.indentStack[this.indentStack.length - 1];
        if (ws.startsWith(bodyIndent) && ws.length >= bodyIndent.length) {
          // Still in body - strip the indent prefix, keep extra
          text = ws.slice(bodyIndent.length);
          continue;
        } else {
          // Dedent - reset position to after whitespace (already consumed)
          // We're leaving the body
          this.emit(TokenKind.Dedent, '', this.line, 0);
          this.indentStack.pop();
          this.recipeBody = false;
          this.recipeBodyPending = false;
          return;
        }
      }

      if (this.ch === '\r') {
        // treat \r\n as \n
        this.advance();
        continue;
      }

      text += this.advance();
    }

    // EOF
    if (text.length > 0) {
      this.emit(TokenKind.Text, text, line, col);
    }
  }

  private lexInterpolation() {
    // Inside {{ }}, lex normally until we hit }}
    if (this.ch === '}' && this.peek() === '}') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.advance();
      this.emit(TokenKind.InterpolationEnd, '}}', line, col);
      this.interpolationDepth--;
      return;
    }
    // Otherwise lex as normal expression
    this.lexNormal();
  }

  private lexIdentifier() {
    const line = this.line;
    const col = this.column;
    const start = this.pos;
    this.advance();
    while (this.pos < this.src.length && isIdentContinue(this.ch!)) {
      this.advance();
    }
    this.emit(TokenKind.Identifier, this.src.slice(start, this.pos), line, col);
  }

  private lexBacktick() {
    const line = this.line;
    const col = this.column;
    this.advance(); // opening `
    
    // Check for triple backtick
    if (this.ch === '`' && this.peek() === '`') {
      this.advance(); // second `
      this.advance(); // third `
      const start = this.pos;
      while (this.pos < this.src.length) {
        if (this.ch === '`' && this.peek() === '`' && this.peek(2) === '`') {
          const value = this.src.slice(start, this.pos);
          this.advance(); this.advance(); this.advance();
          this.emit(TokenKind.Backtick, value, line, col);
          return;
        }
        this.advance();
      }
      this.error('Unterminated backtick');
    }
    
    const start = this.pos;
    while (this.pos < this.src.length && this.ch !== '`') {
      if (this.ch === '\n') this.error('Unterminated backtick');
      this.advance();
    }
    if (this.pos >= this.src.length) this.error('Unterminated backtick');
    const value = this.src.slice(start, this.pos);
    this.advance(); // closing `
    this.emit(TokenKind.Backtick, value, line, col);
  }

  private lexDoubleString() {
    const line = this.line;
    const col = this.column;
    this.advance(); // opening "
    
    // Check for triple quote
    if (this.ch === '"' && this.peek() === '"') {
      this.advance();
      this.advance();
      const start = this.pos;
      while (this.pos < this.src.length) {
        if (this.ch === '"' && this.peek() === '"' && this.peek(2) === '"') {
          const value = this.src.slice(start, this.pos);
          this.advance(); this.advance(); this.advance();
          this.emit(TokenKind.StringLiteral, value, line, col);
          return;
        }
        this.advance();
      }
      this.error('Unterminated string');
    }
    
    let value = '';
    while (this.pos < this.src.length && this.ch !== '"') {
      if (this.ch === '\n') this.error('Unterminated string');
      if (this.ch === '\\') {
        this.advance();
        const esc = this.ch as string;
        this.advance();
        if (esc === 'n') value += '\n';
        else if (esc === 'r') value += '\r';
        else if (esc === 't') value += '\t';
        else if (esc === '\\') value += '\\';
        else if (esc === '"') value += '"';
        else value += '\\' + esc;
        continue;
      }
      value += this.advance();
    }
    if (this.pos >= this.src.length) this.error('Unterminated string');
    this.advance(); // closing "
    this.emit(TokenKind.StringLiteral, value, line, col);
  }

  private lexSingleString() {
    const line = this.line;
    const col = this.column;
    this.advance(); // opening '
    
    // Check for triple quote
    if (this.ch === '\'' && this.peek() === '\'') {
      this.advance();
      this.advance();
      const start = this.pos;
      while (this.pos < this.src.length) {
        if (this.ch === '\'' && this.peek() === '\'' && this.peek(2) === '\'') {
          const value = this.src.slice(start, this.pos);
          this.advance(); this.advance(); this.advance();
          this.emit(TokenKind.StringLiteral, value, line, col);
          return;
        }
        this.advance();
      }
      this.error('Unterminated string');
    }
    
    const start = this.pos;
    while (this.pos < this.src.length && this.ch !== '\'') {
      if (this.ch === '\n') this.error('Unterminated string');
      this.advance();
    }
    if (this.pos >= this.src.length) this.error('Unterminated string');
    const value = this.src.slice(start, this.pos);
    this.advance(); // closing '
    this.emit(TokenKind.StringLiteral, value, line, col);
  }
}

function isIdentStart(c: string): boolean {
  return /^[a-zA-Z_]$/.test(c);
}

function isIdentContinue(c: string): boolean {
  return /^[a-zA-Z0-9_-]$/.test(c);
}
