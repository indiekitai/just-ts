import { TokenKind, Token } from './lexer.js';
import { ParseError } from './error.js';
import type {
  Justfile, Recipe, Assignment, Setting,
  Expression, Parameter, Dependency, Line, Fragment,
} from './ast.js';

export function parse(tokens: Token[]): Justfile {
  return new Parser(tokens).parseJustfile();
}

class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  private current(): Token {
    return this.tokens[this.pos] ?? { kind: TokenKind.Eof, value: '', line: 0, column: 0 };
  }

  private at(kind: TokenKind): boolean {
    return this.current().kind === kind;
  }

  private eat(kind: TokenKind): Token {
    const tok = this.current();
    if (tok.kind !== kind) {
      throw new ParseError(
        `Expected ${kind}, found ${tok.kind} ('${tok.value}')`,
        tok.line, tok.column
      );
    }
    this.pos++;
    return tok;
  }

  private tryEat(kind: TokenKind): Token | null {
    if (this.at(kind)) {
      const tok = this.current();
      this.pos++;
      return tok;
    }
    return null;
  }

  private skipWhitespace() {
    while (this.at(TokenKind.Whitespace)) this.pos++;
  }

  private skipEol() {
    while (this.at(TokenKind.Eol) || this.at(TokenKind.Whitespace) || this.at(TokenKind.Comment)) {
      this.pos++;
    }
  }

  parseJustfile(): Justfile {
    const assignments: Assignment[] = [];
    const recipes: Recipe[] = [];
    const settings: Setting[] = [];

    this.skipEol();

    while (!this.at(TokenKind.Eof)) {
      // Setting: set shell := [...]  or  set name := value
      if (this.at(TokenKind.Identifier) && this.current().value === 'set') {
        const setting = this.parseSetting();
        if (setting) {
          settings.push(setting);
          this.skipEol();
          continue;
        }
      }

      // Export: export name := value
      if (this.at(TokenKind.Identifier) && this.current().value === 'export') {
        const assignment = this.parseExport();
        if (assignment) {
          assignments.push(assignment);
          this.skipEol();
          continue;
        }
      }

      // Look ahead to determine if this is an assignment or recipe
      if (this.at(TokenKind.Identifier)) {
        if (this.isAssignment()) {
          assignments.push(this.parseAssignment(false));
        } else if (this.at(TokenKind.Identifier)) {
          recipes.push(this.parseRecipe(false));
        }
        this.skipEol();
        continue;
      }

      // @ prefix for quiet recipes
      if (this.at(TokenKind.At)) {
        this.pos++;
        recipes.push(this.parseRecipe(true));
        this.skipEol();
        continue;
      }

      // Skip anything else (comments, blank lines)
      this.pos++;
    }

    return { assignments, recipes, settings };
  }

  private isAssignment(): boolean {
    // Scan ahead: identifier whitespace? ':='
    let i = this.pos + 1;
    while (i < this.tokens.length && this.tokens[i].kind === TokenKind.Whitespace) i++;
    return i < this.tokens.length && this.tokens[i].kind === TokenKind.ColonEquals;
  }

  private parseAssignment(exp: boolean): Assignment {
    const name = this.eat(TokenKind.Identifier);
    this.skipWhitespace();
    this.eat(TokenKind.ColonEquals);
    this.skipWhitespace();
    const value = this.parseExpression();
    return { name: name.value, value, export: exp, line: name.line };
  }

  private parseExport(): Assignment | null {
    const saved = this.pos;
    this.pos++; // skip 'export'
    this.skipWhitespace();
    if (!this.at(TokenKind.Identifier)) { this.pos = saved; return null; }
    // Check if it's an assignment
    let i = this.pos + 1;
    while (i < this.tokens.length && this.tokens[i].kind === TokenKind.Whitespace) i++;
    if (i >= this.tokens.length || this.tokens[i].kind !== TokenKind.ColonEquals) {
      this.pos = saved;
      return null;
    }
    return this.parseAssignment(true);
  }

  private parseSetting(): Setting | null {
    const saved = this.pos;
    const setTok = this.current();
    this.pos++; // skip 'set'
    this.skipWhitespace();

    if (!this.at(TokenKind.Identifier)) { this.pos = saved; return null; }
    const nameTok = this.eat(TokenKind.Identifier);
    this.skipWhitespace();

    // set name := value
    if (this.tryEat(TokenKind.ColonEquals)) {
      this.skipWhitespace();
      
      // Array value: ["sh", "-c"]
      if (this.at(TokenKind.Identifier) && this.current().value === '[' || 
          (this.current().kind === TokenKind.StringLiteral)) {
        // For 'set shell', try to parse as: [cmd, args...]
      }
      
      const value = this.parseSettingValue();
      return { name: nameTok.value, value, line: setTok.line };
    }

    // Boolean setting: set name (implicit true)
    return { name: nameTok.value, value: true, line: setTok.line };
  }

  private parseSettingValue(): string | string[] | boolean {
    // Try to detect [...] array
    // Actually in just, `set shell := ["bash", "-c"]` uses bracket syntax
    // But our lexer doesn't emit brackets... let's handle the common case
    // For MVP: set shell := ["bash", "-cu"] is parsed as a string array
    
    if (this.at(TokenKind.Identifier)) {
      const val = this.current().value;
      if (val === 'true') { this.pos++; return true; }
      if (val === 'false') { this.pos++; return false; }
    }
    
    // Single string value
    if (this.at(TokenKind.StringLiteral)) {
      return this.eat(TokenKind.StringLiteral).value;
    }
    
    // For now, consume rest of line as string
    let val = '';
    while (!this.at(TokenKind.Eol) && !this.at(TokenKind.Eof) && !this.at(TokenKind.Comment)) {
      val += this.current().value;
      this.pos++;
    }
    return val.trim();
  }

  private parseRecipe(quiet: boolean): Recipe {
    const nameTok = this.eat(TokenKind.Identifier);
    this.skipWhitespace();

    // Parse parameters
    const params: Parameter[] = [];
    while (this.at(TokenKind.Identifier) || this.at(TokenKind.Plus) || this.at(TokenKind.Star) || this.at(TokenKind.Dollar)) {
      let variadic: 'plus' | 'star' | undefined;
      let _export = false;
      
      if (this.tryEat(TokenKind.Dollar)) {
        _export = true;
      }
      if (this.tryEat(TokenKind.Plus)) {
        variadic = 'plus';
      } else if (this.tryEat(TokenKind.Star)) {
        variadic = 'star';
      }
      
      if (!this.at(TokenKind.Identifier)) break;
      const pName = this.eat(TokenKind.Identifier);
      this.skipWhitespace();
      
      let def: Expression | undefined;
      if (this.tryEat(TokenKind.Equals)) {
        this.skipWhitespace();
        def = this.parseExpression();
        this.skipWhitespace();
      }
      
      params.push({ name: pName.value, default: def, variadic });
      this.skipWhitespace();
    }

    // Colon
    this.eat(TokenKind.Colon);
    this.skipWhitespace();

    // Dependencies
    const deps: Dependency[] = [];
    while (this.at(TokenKind.Identifier)) {
      const depName = this.eat(TokenKind.Identifier).value;
      this.skipWhitespace();
      deps.push({ recipe: depName, args: [] });
    }

    // Skip to end of line
    while (!this.at(TokenKind.Eol) && !this.at(TokenKind.Eof) && !this.at(TokenKind.Indent)) {
      this.pos++;
    }
    this.tryEat(TokenKind.Eol);

    // Parse body
    const body: Line[] = [];
    if (this.at(TokenKind.Indent)) {
      this.pos++; // consume indent
      
      while (!this.at(TokenKind.Dedent) && !this.at(TokenKind.Eof)) {
        const fragments: Fragment[] = [];
        
        while (!this.at(TokenKind.Eol) && !this.at(TokenKind.Dedent) && !this.at(TokenKind.Eof)) {
          if (this.at(TokenKind.Text)) {
            fragments.push({ kind: 'text', value: this.current().value });
            this.pos++;
          } else if (this.at(TokenKind.InterpolationStart)) {
            this.pos++;
            this.skipWhitespace();
            const expr = this.parseExpression();
            this.skipWhitespace();
            this.eat(TokenKind.InterpolationEnd);
            fragments.push({ kind: 'interpolation', expression: expr });
          } else {
            // Unexpected token in body - just consume as text
            fragments.push({ kind: 'text', value: this.current().value });
            this.pos++;
          }
        }
        
        if (fragments.length > 0) {
          body.push({ fragments });
        }
        this.tryEat(TokenKind.Eol);
      }
      
      this.tryEat(TokenKind.Dedent);
    }

    // Look back for doc comment
    let doc: string | undefined;
    // Find the token just before the recipe name (or @)
    for (let i = this.tokens.indexOf(nameTok) - 1; i >= 0; i--) {
      const t = this.tokens[i];
      if (t.kind === TokenKind.Whitespace || t.kind === TokenKind.At) continue;
      if (t.kind === TokenKind.Eol) {
        // Look for comment before the Eol
        for (let j = i - 1; j >= 0; j--) {
          if (this.tokens[j].kind === TokenKind.Comment) {
            const c = this.tokens[j].value;
            doc = c.replace(/^#\s*/, '');
            break;
          }
          if (this.tokens[j].kind !== TokenKind.Whitespace) break;
        }
      }
      break;
    }

    return {
      name: nameTok.value,
      doc,
      quiet,
      params,
      deps,
      body,
      line: nameTok.line,
    };
  }

  private parseExpression(): Expression {
    let left = this.parseAtom();
    this.skipWhitespace();
    
    while (this.at(TokenKind.Plus)) {
      this.pos++;
      this.skipWhitespace();
      const right = this.parseAtom();
      left = { kind: 'concat', left, right };
      this.skipWhitespace();
    }
    
    return left;
  }

  private parseAtom(): Expression {
    if (this.at(TokenKind.StringLiteral)) {
      const tok = this.eat(TokenKind.StringLiteral);
      return { kind: 'string', value: tok.value };
    }
    
    if (this.at(TokenKind.Backtick)) {
      const tok = this.eat(TokenKind.Backtick);
      return { kind: 'backtick', command: tok.value };
    }
    
    if (this.at(TokenKind.Identifier)) {
      const tok = this.eat(TokenKind.Identifier);
      this.skipWhitespace();
      
      // Function call: name(args...)
      if (this.at(TokenKind.ParenL)) {
        this.pos++;
        this.skipWhitespace();
        const args: Expression[] = [];
        while (!this.at(TokenKind.ParenR) && !this.at(TokenKind.Eof)) {
          args.push(this.parseExpression());
          this.skipWhitespace();
          this.tryEat(TokenKind.Comma);
          this.skipWhitespace();
        }
        this.eat(TokenKind.ParenR);
        return { kind: 'call', name: tok.value, args };
      }
      
      return { kind: 'variable', name: tok.value };
    }
    
    if (this.at(TokenKind.ParenL)) {
      this.pos++;
      this.skipWhitespace();
      const expr = this.parseExpression();
      this.skipWhitespace();
      this.eat(TokenKind.ParenR);
      return expr;
    }
    
    const tok = this.current();
    throw new ParseError(`Unexpected token: ${tok.kind} ('${tok.value}')`, tok.line, tok.column);
  }
}
