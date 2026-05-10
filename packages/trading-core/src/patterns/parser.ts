/**
 * Recursive-descent parser for the pattern DSL. The grammar is intentionally
 * small — every node type is enumerated below, every identifier is on a fixed
 * whitelist. Anything outside the whitelist throws at parse time, which is
 * how we make the DSL injection-proof: a user cannot smuggle a function call,
 * property access, or arbitrary identifier through. The evaluator never sees
 * a node it didn't expect.
 *
 * Grammar (lowest to highest precedence):
 *   expr    := orExpr
 *   orExpr  := andExpr ( "or" andExpr )*
 *   andExpr := notExpr ( "and" notExpr )*
 *   notExpr := "not" notExpr | comparison
 *   comparison := addExpr ( ("=" | "!=" | "<" | "<=" | ">" | ">=") addExpr )?
 *   addExpr := mulExpr ( ("+" | "-") mulExpr )*
 *   mulExpr := unary ( ("*" | "/") unary )*
 *   unary   := "-" unary | primary
 *   primary := number | string | identifier | "(" expr ")" | call
 *   call    := identifier "(" argList? ")"   // identifier in PRIMITIVE_FNS
 *   argList := expr ( "," expr )*
 *   identifier := "b" digit+ | "params" "." key | reserved-name
 */

import { PRIMITIVE_FNS, type PrimitiveFnName } from './primitives';

export type Expr =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'bar'; index: number }
  | { type: 'param'; key: string }
  | { type: 'call'; fn: PrimitiveFnName; args: Expr[] }
  | { type: 'unary'; op: 'neg' | 'not'; arg: Expr }
  | {
      type: 'binary';
      op: '+' | '-' | '*' | '/' | '=' | '!=' | '<' | '<=' | '>' | '>=' | 'and' | 'or';
      left: Expr;
      right: Expr;
    };

interface Token {
  kind:
    | 'number'
    | 'string'
    | 'ident'
    | 'op'
    | 'lparen'
    | 'rparen'
    | 'comma'
    | 'dot';
  text: string;
  pos: number;
}

const RESERVED = new Set(['and', 'or', 'not', 'up', 'down', 'flat', 'params']);

export class PatternParseError extends Error {
  public readonly position: number;
  constructor(message: string, position: number) {
    super(`${message} (at pos ${position})`);
    this.position = position;
    this.name = 'PatternParseError';
  }
}

const tokenize = (src: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '(') { tokens.push({ kind: 'lparen', text: '(', pos: i }); i++; continue; }
    if (c === ')') { tokens.push({ kind: 'rparen', text: ')', pos: i }); i++; continue; }
    if (c === ',') { tokens.push({ kind: 'comma', text: ',', pos: i }); i++; continue; }
    if (c === '.') { tokens.push({ kind: 'dot', text: '.', pos: i }); i++; continue; }

    if (c === '<' || c === '>' || c === '=' || c === '!') {
      const next = src[i + 1];
      if (next === '=' || (c === '!' && next === '=')) {
        tokens.push({ kind: 'op', text: src.slice(i, i + 2), pos: i });
        i += 2;
        continue;
      }
      if (c !== '!') {
        tokens.push({ kind: 'op', text: c, pos: i });
        i++;
        continue;
      }
      throw new PatternParseError(`Unexpected '!' (use '!=' for inequality)`, i);
    }

    if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ kind: 'op', text: c, pos: i });
      i++;
      continue;
    }

    if (c === "'" || c === '"') {
      const quote = c;
      const start = i;
      i++;
      let val = '';
      while (i < src.length && src[i] !== quote) { val += src[i]; i++; }
      if (i >= src.length) throw new PatternParseError(`Unterminated string`, start);
      i++;
      tokens.push({ kind: 'string', text: val, pos: start });
      continue;
    }

    if ((c >= '0' && c <= '9') || c === '.') {
      const start = i;
      while (i < src.length && /[0-9.]/.test(src[i]!)) i++;
      const text = src.slice(start, i);
      const num = Number(text);
      if (!Number.isFinite(num)) throw new PatternParseError(`Invalid number "${text}"`, start);
      tokens.push({ kind: 'number', text, pos: start });
      continue;
    }

    if (/[a-zA-Z_]/.test(c)) {
      const start = i;
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i]!)) i++;
      tokens.push({ kind: 'ident', text: src.slice(start, i), pos: start });
      continue;
    }

    throw new PatternParseError(`Unexpected character '${c}'`, i);
  }
  return tokens;
};

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[], private readonly src: string) {}

  parse(): Expr {
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new PatternParseError(`Unexpected token "${this.peek().text}"`, this.peek().pos);
    }
    return expr;
  }

  private peek(): Token {
    if (this.pos >= this.tokens.length) {
      throw new PatternParseError(`Unexpected end of expression`, this.src.length);
    }
    return this.tokens[this.pos]!;
  }

  private match(kind: Token['kind'], text?: string): Token | null {
    if (this.pos >= this.tokens.length) return null;
    const t = this.tokens[this.pos]!;
    if (t.kind !== kind) return null;
    if (text !== undefined && t.text !== text) return null;
    this.pos++;
    return t;
  }

  private expect(kind: Token['kind'], text?: string): Token {
    const t = this.match(kind, text);
    if (!t) {
      const got = this.pos < this.tokens.length ? `"${this.tokens[this.pos]!.text}"` : 'end of expression';
      const want = text ? `"${text}"` : kind;
      throw new PatternParseError(`Expected ${want}, got ${got}`, this.pos < this.tokens.length ? this.tokens[this.pos]!.pos : this.src.length);
    }
    return t;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.match('ident', 'or')) left = { type: 'binary', op: 'or', left, right: this.parseAnd() };
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.match('ident', 'and')) left = { type: 'binary', op: 'and', left, right: this.parseNot() };
    return left;
  }

  private parseNot(): Expr {
    if (this.match('ident', 'not')) return { type: 'unary', op: 'not', arg: this.parseNot() };
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    const left = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos]!;
      if (t.kind === 'op' && ['=', '!=', '<', '<=', '>', '>='].includes(t.text)) {
        this.pos++;
        const right = this.parseAddSub();
        return { type: 'binary', op: t.text as Extract<Expr, { type: 'binary' }>['op'], left, right };
      }
    }
    return left;
  }

  private parseAddSub(): Expr {
    let left = this.parseMulDiv();
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos]!;
      if (t.kind === 'op' && (t.text === '+' || t.text === '-')) {
        this.pos++;
        left = { type: 'binary', op: t.text, left, right: this.parseMulDiv() };
      } else break;
    }
    return left;
  }

  private parseMulDiv(): Expr {
    let left = this.parseUnary();
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos]!;
      if (t.kind === 'op' && (t.text === '*' || t.text === '/')) {
        this.pos++;
        left = { type: 'binary', op: t.text, left, right: this.parseUnary() };
      } else break;
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos]!;
      if (t.kind === 'op' && t.text === '-') {
        this.pos++;
        return { type: 'unary', op: 'neg', arg: this.parseUnary() };
      }
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.peek();

    if (t.kind === 'number') {
      this.pos++;
      return { type: 'number', value: Number(t.text) };
    }

    if (t.kind === 'string') {
      this.pos++;
      return { type: 'string', value: t.text };
    }

    if (t.kind === 'lparen') {
      this.pos++;
      const e = this.parseOr();
      this.expect('rparen');
      return e;
    }

    if (t.kind === 'ident') {
      this.pos++;
      // Reserved word literals — `up` / `down` / `flat` are direction string literals.
      if (t.text === 'up' || t.text === 'down' || t.text === 'flat') {
        return { type: 'string', value: t.text };
      }
      // Bar reference: b0, b1, b2, ...
      if (/^b\d+$/.test(t.text)) {
        return { type: 'bar', index: Number(t.text.slice(1)) };
      }
      // params.<key>
      if (t.text === 'params') {
        this.expect('dot');
        const k = this.expect('ident');
        return { type: 'param', key: k.text };
      }
      // Function call: identifier(...)
      if (this.match('lparen')) {
        if (!(t.text in PRIMITIVE_FNS)) {
          throw new PatternParseError(`Unknown function "${t.text}"`, t.pos);
        }
        const args: Expr[] = [];
        if (!this.match('rparen')) {
          args.push(this.parseOr());
          while (this.match('comma')) args.push(this.parseOr());
          this.expect('rparen');
        }
        return { type: 'call', fn: t.text as PrimitiveFnName, args };
      }
      if (RESERVED.has(t.text)) {
        throw new PatternParseError(`Reserved word "${t.text}" cannot be used as a value here`, t.pos);
      }
      throw new PatternParseError(`Unknown identifier "${t.text}" — must be a primitive function, b<index>, or params.<key>`, t.pos);
    }

    throw new PatternParseError(`Unexpected token "${t.text}"`, t.pos);
  }
}

export const parsePatternExpression = (src: string): Expr => {
  const tokens = tokenize(src);
  if (tokens.length === 0) throw new PatternParseError(`Empty expression`, 0);
  return new Parser(tokens, src).parse();
};
