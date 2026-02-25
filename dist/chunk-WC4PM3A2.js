// src/error.ts
var JustError = class extends Error {
  constructor(message, line, column) {
    super(message);
    this.line = line;
    this.column = column;
    this.name = "JustError";
  }
};
var LexError = class extends JustError {
  constructor(message, line, column) {
    super(message, line, column);
    this.name = "LexError";
  }
};
var ParseError = class extends JustError {
  constructor(message, line, column) {
    super(message, line, column);
    this.name = "ParseError";
  }
};
var RuntimeError = class extends JustError {
  constructor(message) {
    super(message);
    this.name = "RuntimeError";
  }
};

// src/lexer.ts
var TokenKind = /* @__PURE__ */ ((TokenKind2) => {
  TokenKind2["At"] = "At";
  TokenKind2["Colon"] = "Colon";
  TokenKind2["ColonEquals"] = "ColonEquals";
  TokenKind2["Comma"] = "Comma";
  TokenKind2["Equals"] = "Equals";
  TokenKind2["ParenL"] = "ParenL";
  TokenKind2["ParenR"] = "ParenR";
  TokenKind2["Plus"] = "Plus";
  TokenKind2["Star"] = "Star";
  TokenKind2["Dollar"] = "Dollar";
  TokenKind2["Identifier"] = "Identifier";
  TokenKind2["StringLiteral"] = "StringLiteral";
  TokenKind2["Backtick"] = "Backtick";
  TokenKind2["Comment"] = "Comment";
  TokenKind2["Indent"] = "Indent";
  TokenKind2["Dedent"] = "Dedent";
  TokenKind2["Eol"] = "Eol";
  TokenKind2["Eof"] = "Eof";
  TokenKind2["Whitespace"] = "Whitespace";
  TokenKind2["Text"] = "Text";
  TokenKind2["InterpolationStart"] = "InterpolationStart";
  TokenKind2["InterpolationEnd"] = "InterpolationEnd";
  return TokenKind2;
})(TokenKind || {});
function lex(src) {
  return new Lexer(src).tokenize();
}
var Lexer = class {
  constructor(src) {
    this.src = src;
  }
  pos = 0;
  line = 0;
  column = 0;
  tokens = [];
  indentStack = [""];
  recipeBody = false;
  recipeBodyPending = false;
  interpolationDepth = 0;
  get ch() {
    return this.src[this.pos];
  }
  peek(offset = 1) {
    return this.src[this.pos + offset];
  }
  advance() {
    const c = this.src[this.pos];
    this.pos++;
    if (c === "\n") {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    return c;
  }
  emit(kind, value, line, column) {
    this.tokens.push({ kind, value, line, column });
  }
  error(msg) {
    throw new LexError(msg, this.line, this.column);
  }
  tokenize() {
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
    while (this.indentStack.length > 1) {
      this.emit("Dedent" /* Dedent */, "", this.line, this.column);
      this.indentStack.pop();
      this.recipeBody = false;
      this.recipeBodyPending = false;
    }
    this.emit("Eof" /* Eof */, "", this.line, this.column);
    return this.tokens;
  }
  lexLineStart() {
    const startPos = this.pos;
    while (this.pos < this.src.length && (this.ch === " " || this.ch === "	")) {
      this.advance();
    }
    const whitespace = this.src.slice(startPos, this.pos);
    if (this.ch === "\n" || this.ch === "\r" || this.pos >= this.src.length) {
      return;
    }
    if (this.ch === "#" && !this.recipeBody) {
      return;
    }
    const currentIndent = this.indentStack[this.indentStack.length - 1];
    if (this.recipeBody || this.recipeBodyPending) {
      if (whitespace.length > currentIndent.length && whitespace.startsWith(currentIndent)) {
        if (this.recipeBodyPending && !this.recipeBody) {
          this.indentStack.push(whitespace);
          this.emit("Indent" /* Indent */, whitespace, this.line, 0);
          this.recipeBody = true;
          this.recipeBodyPending = false;
        }
        return;
      } else if (whitespace === currentIndent && this.recipeBody) {
        return;
      } else {
        if (this.recipeBody) {
          this.emit("Dedent" /* Dedent */, "", this.line, 0);
          this.indentStack.pop();
          this.recipeBody = false;
          this.recipeBodyPending = false;
        } else {
          this.recipeBodyPending = false;
        }
      }
    }
  }
  lexNormal() {
    const c = this.ch;
    const line = this.line;
    const col = this.column;
    switch (c) {
      case " ":
      case "	": {
        const start = this.pos;
        while (this.pos < this.src.length && (this.ch === " " || this.ch === "	")) {
          this.advance();
        }
        this.emit("Whitespace" /* Whitespace */, this.src.slice(start, this.pos), line, col);
        break;
      }
      case "\n": {
        this.advance();
        this.emit("Eol" /* Eol */, "\n", line, col);
        break;
      }
      case "\r": {
        this.advance();
        if (this.ch === "\n") this.advance();
        this.emit("Eol" /* Eol */, "\n", line, col);
        break;
      }
      case "#": {
        const start = this.pos;
        while (this.pos < this.src.length && this.ch !== "\n") {
          this.advance();
        }
        this.emit("Comment" /* Comment */, this.src.slice(start, this.pos), line, col);
        break;
      }
      case ":": {
        this.advance();
        if (this.ch === "=") {
          this.advance();
          this.emit("ColonEquals" /* ColonEquals */, ":=", line, col);
        } else {
          this.emit("Colon" /* Colon */, ":", line, col);
          this.recipeBodyPending = true;
        }
        break;
      }
      case "=": {
        this.advance();
        this.emit("Equals" /* Equals */, "=", line, col);
        break;
      }
      case "@": {
        this.advance();
        this.emit("At" /* At */, "@", line, col);
        break;
      }
      case "+": {
        this.advance();
        this.emit("Plus" /* Plus */, "+", line, col);
        break;
      }
      case "*": {
        this.advance();
        this.emit("Star" /* Star */, "*", line, col);
        break;
      }
      case "$": {
        this.advance();
        this.emit("Dollar" /* Dollar */, "$", line, col);
        break;
      }
      case ",": {
        this.advance();
        this.emit("Comma" /* Comma */, ",", line, col);
        break;
      }
      case "(": {
        this.advance();
        this.emit("ParenL" /* ParenL */, "(", line, col);
        break;
      }
      case ")": {
        this.advance();
        this.emit("ParenR" /* ParenR */, ")", line, col);
        break;
      }
      case "`": {
        this.lexBacktick();
        break;
      }
      case '"': {
        this.lexDoubleString();
        break;
      }
      case "'": {
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
  lexBody() {
    const line = this.line;
    const col = this.column;
    let text = "";
    const startPos = this.pos;
    const indent = this.indentStack[this.indentStack.length - 1];
    while (this.pos < this.src.length) {
      if (this.ch === "{" && this.peek() === "{") {
        if (text.length > 0) {
          this.emit("Text" /* Text */, text, line, col);
          text = "";
        }
        const iLine = this.line;
        const iCol = this.column;
        this.advance();
        this.advance();
        if (this.ch === "{" && this.peek() === "{") {
          this.advance();
          this.advance();
          text += "{{";
          continue;
        }
        this.emit("InterpolationStart" /* InterpolationStart */, "{{", iLine, iCol);
        this.interpolationDepth++;
        return;
      }
      if (this.ch === "\n") {
        if (text.length > 0) {
          this.emit("Text" /* Text */, text, line, col);
          text = "";
        }
        const nlLine = this.line;
        const nlCol = this.column;
        this.advance();
        this.emit("Eol" /* Eol */, "\n", nlLine, nlCol);
        const nextLineStart = this.pos;
        let ws = "";
        while (this.pos < this.src.length && (this.ch === " " || this.ch === "	")) {
          ws += this.advance();
        }
        const nextCh = this.ch;
        if (this.pos >= this.src.length || nextCh === "\n" || nextCh === "\r") {
          continue;
        }
        const bodyIndent = this.indentStack[this.indentStack.length - 1];
        if (ws.startsWith(bodyIndent) && ws.length >= bodyIndent.length) {
          text = ws.slice(bodyIndent.length);
          continue;
        } else {
          this.emit("Dedent" /* Dedent */, "", this.line, 0);
          this.indentStack.pop();
          this.recipeBody = false;
          this.recipeBodyPending = false;
          return;
        }
      }
      if (this.ch === "\r") {
        this.advance();
        continue;
      }
      text += this.advance();
    }
    if (text.length > 0) {
      this.emit("Text" /* Text */, text, line, col);
    }
  }
  lexInterpolation() {
    if (this.ch === "}" && this.peek() === "}") {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.advance();
      this.emit("InterpolationEnd" /* InterpolationEnd */, "}}", line, col);
      this.interpolationDepth--;
      return;
    }
    this.lexNormal();
  }
  lexIdentifier() {
    const line = this.line;
    const col = this.column;
    const start = this.pos;
    this.advance();
    while (this.pos < this.src.length && isIdentContinue(this.ch)) {
      this.advance();
    }
    this.emit("Identifier" /* Identifier */, this.src.slice(start, this.pos), line, col);
  }
  lexBacktick() {
    const line = this.line;
    const col = this.column;
    this.advance();
    if (this.ch === "`" && this.peek() === "`") {
      this.advance();
      this.advance();
      const start2 = this.pos;
      while (this.pos < this.src.length) {
        if (this.ch === "`" && this.peek() === "`" && this.peek(2) === "`") {
          const value2 = this.src.slice(start2, this.pos);
          this.advance();
          this.advance();
          this.advance();
          this.emit("Backtick" /* Backtick */, value2, line, col);
          return;
        }
        this.advance();
      }
      this.error("Unterminated backtick");
    }
    const start = this.pos;
    while (this.pos < this.src.length && this.ch !== "`") {
      if (this.ch === "\n") this.error("Unterminated backtick");
      this.advance();
    }
    if (this.pos >= this.src.length) this.error("Unterminated backtick");
    const value = this.src.slice(start, this.pos);
    this.advance();
    this.emit("Backtick" /* Backtick */, value, line, col);
  }
  lexDoubleString() {
    const line = this.line;
    const col = this.column;
    this.advance();
    if (this.ch === '"' && this.peek() === '"') {
      this.advance();
      this.advance();
      const start = this.pos;
      while (this.pos < this.src.length) {
        if (this.ch === '"' && this.peek() === '"' && this.peek(2) === '"') {
          const value2 = this.src.slice(start, this.pos);
          this.advance();
          this.advance();
          this.advance();
          this.emit("StringLiteral" /* StringLiteral */, value2, line, col);
          return;
        }
        this.advance();
      }
      this.error("Unterminated string");
    }
    let value = "";
    while (this.pos < this.src.length && this.ch !== '"') {
      if (this.ch === "\n") this.error("Unterminated string");
      if (this.ch === "\\") {
        this.advance();
        const esc = this.ch;
        this.advance();
        if (esc === "n") value += "\n";
        else if (esc === "r") value += "\r";
        else if (esc === "t") value += "	";
        else if (esc === "\\") value += "\\";
        else if (esc === '"') value += '"';
        else value += "\\" + esc;
        continue;
      }
      value += this.advance();
    }
    if (this.pos >= this.src.length) this.error("Unterminated string");
    this.advance();
    this.emit("StringLiteral" /* StringLiteral */, value, line, col);
  }
  lexSingleString() {
    const line = this.line;
    const col = this.column;
    this.advance();
    if (this.ch === "'" && this.peek() === "'") {
      this.advance();
      this.advance();
      const start2 = this.pos;
      while (this.pos < this.src.length) {
        if (this.ch === "'" && this.peek() === "'" && this.peek(2) === "'") {
          const value2 = this.src.slice(start2, this.pos);
          this.advance();
          this.advance();
          this.advance();
          this.emit("StringLiteral" /* StringLiteral */, value2, line, col);
          return;
        }
        this.advance();
      }
      this.error("Unterminated string");
    }
    const start = this.pos;
    while (this.pos < this.src.length && this.ch !== "'") {
      if (this.ch === "\n") this.error("Unterminated string");
      this.advance();
    }
    if (this.pos >= this.src.length) this.error("Unterminated string");
    const value = this.src.slice(start, this.pos);
    this.advance();
    this.emit("StringLiteral" /* StringLiteral */, value, line, col);
  }
};
function isIdentStart(c) {
  return /^[a-zA-Z_]$/.test(c);
}
function isIdentContinue(c) {
  return /^[a-zA-Z0-9_-]$/.test(c);
}

// src/parser.ts
function parse(tokens) {
  return new Parser(tokens).parseJustfile();
}
var Parser = class {
  constructor(tokens) {
    this.tokens = tokens;
  }
  pos = 0;
  current() {
    return this.tokens[this.pos] ?? { kind: "Eof" /* Eof */, value: "", line: 0, column: 0 };
  }
  at(kind) {
    return this.current().kind === kind;
  }
  eat(kind) {
    const tok = this.current();
    if (tok.kind !== kind) {
      throw new ParseError(
        `Expected ${kind}, found ${tok.kind} ('${tok.value}')`,
        tok.line,
        tok.column
      );
    }
    this.pos++;
    return tok;
  }
  tryEat(kind) {
    if (this.at(kind)) {
      const tok = this.current();
      this.pos++;
      return tok;
    }
    return null;
  }
  skipWhitespace() {
    while (this.at("Whitespace" /* Whitespace */)) this.pos++;
  }
  skipEol() {
    while (this.at("Eol" /* Eol */) || this.at("Whitespace" /* Whitespace */) || this.at("Comment" /* Comment */)) {
      this.pos++;
    }
  }
  parseJustfile() {
    const assignments = [];
    const recipes = [];
    const settings = [];
    this.skipEol();
    while (!this.at("Eof" /* Eof */)) {
      if (this.at("Identifier" /* Identifier */) && this.current().value === "set") {
        const setting = this.parseSetting();
        if (setting) {
          settings.push(setting);
          this.skipEol();
          continue;
        }
      }
      if (this.at("Identifier" /* Identifier */) && this.current().value === "export") {
        const assignment = this.parseExport();
        if (assignment) {
          assignments.push(assignment);
          this.skipEol();
          continue;
        }
      }
      if (this.at("Identifier" /* Identifier */)) {
        if (this.isAssignment()) {
          assignments.push(this.parseAssignment(false));
        } else if (this.at("Identifier" /* Identifier */)) {
          recipes.push(this.parseRecipe(false));
        }
        this.skipEol();
        continue;
      }
      if (this.at("At" /* At */)) {
        this.pos++;
        recipes.push(this.parseRecipe(true));
        this.skipEol();
        continue;
      }
      this.pos++;
    }
    return { assignments, recipes, settings };
  }
  isAssignment() {
    let i = this.pos + 1;
    while (i < this.tokens.length && this.tokens[i].kind === "Whitespace" /* Whitespace */) i++;
    return i < this.tokens.length && this.tokens[i].kind === "ColonEquals" /* ColonEquals */;
  }
  parseAssignment(exp) {
    const name = this.eat("Identifier" /* Identifier */);
    this.skipWhitespace();
    this.eat("ColonEquals" /* ColonEquals */);
    this.skipWhitespace();
    const value = this.parseExpression();
    return { name: name.value, value, export: exp, line: name.line };
  }
  parseExport() {
    const saved = this.pos;
    this.pos++;
    this.skipWhitespace();
    if (!this.at("Identifier" /* Identifier */)) {
      this.pos = saved;
      return null;
    }
    let i = this.pos + 1;
    while (i < this.tokens.length && this.tokens[i].kind === "Whitespace" /* Whitespace */) i++;
    if (i >= this.tokens.length || this.tokens[i].kind !== "ColonEquals" /* ColonEquals */) {
      this.pos = saved;
      return null;
    }
    return this.parseAssignment(true);
  }
  parseSetting() {
    const saved = this.pos;
    const setTok = this.current();
    this.pos++;
    this.skipWhitespace();
    if (!this.at("Identifier" /* Identifier */)) {
      this.pos = saved;
      return null;
    }
    const nameTok = this.eat("Identifier" /* Identifier */);
    this.skipWhitespace();
    if (this.tryEat("ColonEquals" /* ColonEquals */)) {
      this.skipWhitespace();
      if (this.at("Identifier" /* Identifier */) && this.current().value === "[" || this.current().kind === "StringLiteral" /* StringLiteral */) {
      }
      const value = this.parseSettingValue();
      return { name: nameTok.value, value, line: setTok.line };
    }
    return { name: nameTok.value, value: true, line: setTok.line };
  }
  parseSettingValue() {
    if (this.at("Identifier" /* Identifier */)) {
      const val2 = this.current().value;
      if (val2 === "true") {
        this.pos++;
        return true;
      }
      if (val2 === "false") {
        this.pos++;
        return false;
      }
    }
    if (this.at("StringLiteral" /* StringLiteral */)) {
      return this.eat("StringLiteral" /* StringLiteral */).value;
    }
    let val = "";
    while (!this.at("Eol" /* Eol */) && !this.at("Eof" /* Eof */) && !this.at("Comment" /* Comment */)) {
      val += this.current().value;
      this.pos++;
    }
    return val.trim();
  }
  parseRecipe(quiet) {
    const nameTok = this.eat("Identifier" /* Identifier */);
    this.skipWhitespace();
    const params = [];
    while (this.at("Identifier" /* Identifier */) || this.at("Plus" /* Plus */) || this.at("Star" /* Star */) || this.at("Dollar" /* Dollar */)) {
      let variadic;
      let _export = false;
      if (this.tryEat("Dollar" /* Dollar */)) {
        _export = true;
      }
      if (this.tryEat("Plus" /* Plus */)) {
        variadic = "plus";
      } else if (this.tryEat("Star" /* Star */)) {
        variadic = "star";
      }
      if (!this.at("Identifier" /* Identifier */)) break;
      const pName = this.eat("Identifier" /* Identifier */);
      this.skipWhitespace();
      let def;
      if (this.tryEat("Equals" /* Equals */)) {
        this.skipWhitespace();
        def = this.parseExpression();
        this.skipWhitespace();
      }
      params.push({ name: pName.value, default: def, variadic });
      this.skipWhitespace();
    }
    this.eat("Colon" /* Colon */);
    this.skipWhitespace();
    const deps = [];
    while (this.at("Identifier" /* Identifier */)) {
      const depName = this.eat("Identifier" /* Identifier */).value;
      this.skipWhitespace();
      deps.push({ recipe: depName, args: [] });
    }
    while (!this.at("Eol" /* Eol */) && !this.at("Eof" /* Eof */) && !this.at("Indent" /* Indent */)) {
      this.pos++;
    }
    this.tryEat("Eol" /* Eol */);
    const body = [];
    if (this.at("Indent" /* Indent */)) {
      this.pos++;
      while (!this.at("Dedent" /* Dedent */) && !this.at("Eof" /* Eof */)) {
        const fragments = [];
        while (!this.at("Eol" /* Eol */) && !this.at("Dedent" /* Dedent */) && !this.at("Eof" /* Eof */)) {
          if (this.at("Text" /* Text */)) {
            fragments.push({ kind: "text", value: this.current().value });
            this.pos++;
          } else if (this.at("InterpolationStart" /* InterpolationStart */)) {
            this.pos++;
            this.skipWhitespace();
            const expr = this.parseExpression();
            this.skipWhitespace();
            this.eat("InterpolationEnd" /* InterpolationEnd */);
            fragments.push({ kind: "interpolation", expression: expr });
          } else {
            fragments.push({ kind: "text", value: this.current().value });
            this.pos++;
          }
        }
        if (fragments.length > 0) {
          body.push({ fragments });
        }
        this.tryEat("Eol" /* Eol */);
      }
      this.tryEat("Dedent" /* Dedent */);
    }
    let doc;
    for (let i = this.tokens.indexOf(nameTok) - 1; i >= 0; i--) {
      const t = this.tokens[i];
      if (t.kind === "Whitespace" /* Whitespace */ || t.kind === "At" /* At */) continue;
      if (t.kind === "Eol" /* Eol */) {
        for (let j = i - 1; j >= 0; j--) {
          if (this.tokens[j].kind === "Comment" /* Comment */) {
            const c = this.tokens[j].value;
            doc = c.replace(/^#\s*/, "");
            break;
          }
          if (this.tokens[j].kind !== "Whitespace" /* Whitespace */) break;
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
      line: nameTok.line
    };
  }
  parseExpression() {
    let left = this.parseAtom();
    this.skipWhitespace();
    while (this.at("Plus" /* Plus */)) {
      this.pos++;
      this.skipWhitespace();
      const right = this.parseAtom();
      left = { kind: "concat", left, right };
      this.skipWhitespace();
    }
    return left;
  }
  parseAtom() {
    if (this.at("StringLiteral" /* StringLiteral */)) {
      const tok2 = this.eat("StringLiteral" /* StringLiteral */);
      return { kind: "string", value: tok2.value };
    }
    if (this.at("Backtick" /* Backtick */)) {
      const tok2 = this.eat("Backtick" /* Backtick */);
      return { kind: "backtick", command: tok2.value };
    }
    if (this.at("Identifier" /* Identifier */)) {
      const tok2 = this.eat("Identifier" /* Identifier */);
      this.skipWhitespace();
      if (this.at("ParenL" /* ParenL */)) {
        this.pos++;
        this.skipWhitespace();
        const args = [];
        while (!this.at("ParenR" /* ParenR */) && !this.at("Eof" /* Eof */)) {
          args.push(this.parseExpression());
          this.skipWhitespace();
          this.tryEat("Comma" /* Comma */);
          this.skipWhitespace();
        }
        this.eat("ParenR" /* ParenR */);
        return { kind: "call", name: tok2.value, args };
      }
      return { kind: "variable", name: tok2.value };
    }
    if (this.at("ParenL" /* ParenL */)) {
      this.pos++;
      this.skipWhitespace();
      const expr = this.parseExpression();
      this.skipWhitespace();
      this.eat("ParenR" /* ParenR */);
      return expr;
    }
    const tok = this.current();
    throw new ParseError(`Unexpected token: ${tok.kind} ('${tok.value}')`, tok.line, tok.column);
  }
};

// src/justfile.ts
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
var JUSTFILE_NAMES = ["justfile", "Justfile", ".justfile"];
function findJustfile(dir = process.cwd()) {
  let current = resolve(dir);
  while (true) {
    for (const name of JUSTFILE_NAMES) {
      const path = resolve(current, name);
      try {
        readFileSync(path, "utf-8");
        return path;
      } catch {
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new JustError("No justfile found");
    }
    current = parent;
  }
}
function loadJustfile(path) {
  const src = readFileSync(path, "utf-8");
  return parseJustfile(src);
}
function parseJustfile(src) {
  const tokens = lex(src);
  return parse(tokens);
}

// src/evaluator.ts
import { execSync } from "child_process";
function evaluateAssignments(justfile, overrides) {
  const shell = getShell(justfile);
  const scope = /* @__PURE__ */ new Map();
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      scope.set(k, v);
    }
  }
  for (const assignment of justfile.assignments) {
    if (scope.has(assignment.name)) continue;
    const value = evaluateExpression(assignment.value, { scope, shell });
    scope.set(assignment.name, value);
  }
  return scope;
}
function getShell(justfile) {
  const shellSetting = justfile.settings.find((s) => s.name === "shell");
  if (shellSetting) {
    const val = shellSetting.value;
    if (Array.isArray(val) && val.length > 0) {
      return val;
    }
    if (typeof val === "string") {
      return [val, "-c"];
    }
  }
  return ["sh", "-cu"];
}
function evaluateExpression(expr, ctx) {
  switch (expr.kind) {
    case "string":
      return expr.value;
    case "variable": {
      const val = ctx.scope.get(expr.name);
      if (val === void 0) {
        throw new RuntimeError(`Variable '${expr.name}' not defined`);
      }
      return val;
    }
    case "backtick": {
      if (ctx.dryRun) return `\`${expr.command}\``;
      try {
        const [cmd, ...args] = ctx.shell;
        return execSync(`${cmd} ${args.map((a) => `'${a}'`).join(" ")} '${expr.command.replace(/'/g, "'\\''")}'`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"]
        }).replace(/\n$/, "");
      } catch (e) {
        throw new RuntimeError(`Backtick failed: ${e.message}`);
      }
    }
    case "concat":
      return evaluateExpression(expr.left, ctx) + evaluateExpression(expr.right, ctx);
    case "call":
      return evaluateCall(expr.name, expr.args.map((a) => evaluateExpression(a, ctx)));
    default:
      throw new RuntimeError(`Unknown expression kind: ${expr.kind}`);
  }
}
function evaluateCall(name, args) {
  switch (name) {
    case "env_var":
      if (args.length !== 1) throw new RuntimeError(`env_var() takes 1 argument`);
      const val = process.env[args[0]];
      if (val === void 0) throw new RuntimeError(`Environment variable '${args[0]}' not set`);
      return val;
    case "env_var_or_default":
      if (args.length !== 2) throw new RuntimeError(`env_var_or_default() takes 2 arguments`);
      return process.env[args[0]] ?? args[1];
    case "arch":
      return process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch;
    case "os":
      return process.platform === "darwin" ? "macos" : process.platform;
    case "os_family":
      return process.platform === "win32" ? "windows" : "unix";
    case "uppercase":
      return args[0]?.toUpperCase() ?? "";
    case "lowercase":
      return args[0]?.toLowerCase() ?? "";
    case "trim":
      return args[0]?.trim() ?? "";
    case "replace":
      if (args.length !== 3) throw new RuntimeError(`replace() takes 3 arguments`);
      return args[0].split(args[1]).join(args[2]);
    default:
      throw new RuntimeError(`Unknown function: ${name}()`);
  }
}

// src/executor.ts
import { spawn } from "child_process";
async function run(options) {
  const { justfile, args = [], dryRun = false, overrides } = options;
  const recipeName = options.recipe ?? justfile.recipes[0]?.name;
  if (!recipeName) {
    throw new RuntimeError("No recipes defined");
  }
  const scope = evaluateAssignments(justfile, overrides);
  const shell = getShell(justfile);
  const ctx = { scope, shell, dryRun };
  const executed = /* @__PURE__ */ new Set();
  await executeRecipe(justfile, recipeName, args, ctx, executed);
}
async function executeRecipe(justfile, name, args, ctx, executed) {
  if (executed.has(name)) return;
  executed.add(name);
  const recipe = justfile.recipes.find((r) => r.name === name);
  if (!recipe) {
    throw new RuntimeError(`Recipe '${name}' not found`);
  }
  const recipeScope = new Map(ctx.scope);
  for (let i = 0; i < recipe.params.length; i++) {
    const param = recipe.params[i];
    if (param.variadic === "plus") {
      const rest = args.slice(i);
      if (rest.length === 0) {
        throw new RuntimeError(`Recipe '${name}' requires at least one argument for '${param.name}'`);
      }
      recipeScope.set(param.name, rest.join(" "));
      break;
    } else if (param.variadic === "star") {
      recipeScope.set(param.name, args.slice(i).join(" "));
      break;
    } else if (i < args.length) {
      recipeScope.set(param.name, args[i]);
    } else if (param.default) {
      recipeScope.set(param.name, evaluateExpression(param.default, ctx));
    } else {
      throw new RuntimeError(`Recipe '${name}' missing argument '${param.name}'`);
    }
  }
  const recipeCtx = { ...ctx, scope: recipeScope };
  for (const dep of recipe.deps) {
    const depArgs = dep.args.map((a) => evaluateExpression(a, recipeCtx));
    await executeRecipe(justfile, dep.recipe, depArgs, ctx, executed);
  }
  for (const line of recipe.body) {
    const command = renderLine(line, recipeCtx);
    if (ctx.dryRun) {
      console.log(command);
      continue;
    }
    const quiet = recipe.quiet || command.startsWith("@");
    const cmd = command.startsWith("@") ? command.slice(1) : command;
    if (!quiet) {
      console.log(cmd);
    }
    await runCommand(cmd, ctx.shell);
  }
}
function renderLine(line, ctx) {
  return line.fragments.map((f) => {
    if (f.kind === "text") return f.value;
    return evaluateExpression(f.expression, ctx);
  }).join("");
}
async function runCommand(command, shell) {
  const [cmd, ...shellArgs] = shell;
  return new Promise((resolve2, reject) => {
    const child = spawn(cmd, [...shellArgs, command], {
      stdio: "inherit",
      env: process.env
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new RuntimeError(`Recipe failed with exit code ${code}`));
      } else {
        resolve2();
      }
    });
    child.on("error", (err) => {
      reject(new RuntimeError(`Failed to execute command: ${err.message}`));
    });
  });
}

export {
  JustError,
  LexError,
  ParseError,
  RuntimeError,
  TokenKind,
  lex,
  parse,
  findJustfile,
  loadJustfile,
  parseJustfile,
  evaluateAssignments,
  evaluateExpression,
  run
};
