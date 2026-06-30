// Tiny safe expression evaluator for user-defined formulas.
// Supports: + - * / ( ) ^, unary -, numbers, identifiers, function calls.
// No `eval` / `new Function`. Variables are resolved from a context dict.

export type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" };

export interface AstNode {
  type: "num" | "var" | "bin" | "unary" | "call";
  value?: number | string;
  op?: string;
  args?: AstNode[];
  left?: AstNode;
  right?: AstNode;
  child?: AstNode;
}

export class FormulaError extends Error {}

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sqrt: Math.sqrt,
  log: Math.log,
  pow: Math.pow,
  if: (cond, a, b) => (cond ? a : b),
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && input[i + 1] >= "0" && input[i + 1] <= "9")) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const num = Number(input.slice(i, j));
      if (!Number.isFinite(num)) throw new FormulaError(`Número inválido: ${input.slice(i, j)}`);
      tokens.push({ t: "num", v: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j++;
      tokens.push({ t: "id", v: input.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "(") { tokens.push({ t: "lp" }); i++; continue; }
    if (c === ")") { tokens.push({ t: "rp" }); i++; continue; }
    if (c === ",") { tokens.push({ t: "comma" }); i++; continue; }
    if ("+-*/^".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new FormulaError(`Caractere inesperado: "${c}"`);
  }
  return tokens;
}

// Precedence: ^ > unary > * / > + -
const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };
const RIGHT_ASSOC = new Set(["^"]);

function parse(tokens: Token[]): AstNode {
  let pos = 0;
  const peek = () => tokens[pos];

  const parseExpr = (minPrec = 0): AstNode => {
    let left = parsePrefix();
    while (true) {
      const t = peek();
      if (!t || t.t !== "op") break;
      const prec = PRECEDENCE[t.v];
      if (prec == null || prec < minPrec) break;
      pos++;
      const nextMin = RIGHT_ASSOC.has(t.v) ? prec : prec + 1;
      const right = parseExpr(nextMin);
      left = { type: "bin", op: t.v, left, right };
    }
    return left;
  };

  const parsePrefix = (): AstNode => {
    const t = peek();
    if (!t) throw new FormulaError("Fórmula incompleta");
    if (t.t === "op" && (t.v === "-" || t.v === "+")) {
      pos++;
      const child = parsePrefix();
      if (t.v === "-") return { type: "unary", op: "-", child };
      return child;
    }
    if (t.t === "num") { pos++; return { type: "num", value: t.v }; }
    if (t.t === "lp") {
      pos++;
      const e = parseExpr();
      if (peek()?.t !== "rp") throw new FormulaError("Parêntese ')' em falta");
      pos++;
      return e;
    }
    if (t.t === "id") {
      pos++;
      if (peek()?.t === "lp") {
        pos++;
        const args: AstNode[] = [];
        if (peek()?.t !== "rp") {
          args.push(parseExpr());
          while (peek()?.t === "comma") { pos++; args.push(parseExpr()); }
        }
        if (peek()?.t !== "rp") throw new FormulaError("Parêntese ')' em falta numa chamada");
        pos++;
        return { type: "call", value: t.v.toLowerCase(), args };
      }
      return { type: "var", value: t.v.toUpperCase() };
    }
    throw new FormulaError("Token inesperado");
  };

  const ast = parseExpr();
  if (pos < tokens.length) throw new FormulaError("Tokens em excesso no fim da fórmula");
  return ast;
}

export function compileFormula(src: string): AstNode {
  const trimmed = (src ?? "").trim();
  if (!trimmed) throw new FormulaError("Fórmula vazia");
  return parse(tokenize(trimmed));
}

export function listVariables(ast: AstNode, out: Set<string> = new Set()): Set<string> {
  if (ast.type === "var") out.add(String(ast.value));
  if (ast.type === "bin") {
    listVariables(ast.left!, out);
    listVariables(ast.right!, out);
  }
  if (ast.type === "unary") listVariables(ast.child!, out);
  if (ast.type === "call") for (const a of ast.args ?? []) listVariables(a, out);
  return out;
}

export function evalAst(ast: AstNode, ctx: Record<string, number>): number {
  switch (ast.type) {
    case "num": return ast.value as number;
    case "var": {
      const k = String(ast.value);
      const v = ctx[k];
      return typeof v === "number" && Number.isFinite(v) ? v : 0;
    }
    case "unary": return -evalAst(ast.child!, ctx);
    case "bin": {
      const a = evalAst(ast.left!, ctx);
      const b = evalAst(ast.right!, ctx);
      switch (ast.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? 0 : a / b;
        case "^": return Math.pow(a, b);
      }
      throw new FormulaError(`Operador desconhecido: ${ast.op}`);
    }
    case "call": {
      const fn = FUNCTIONS[String(ast.value)];
      if (!fn) throw new FormulaError(`Função desconhecida: ${ast.value}`);
      const args = (ast.args ?? []).map((a) => evalAst(a, ctx));
      const out = fn(...args);
      return Number.isFinite(out) ? out : 0;
    }
  }
}

export interface FormulaValidation {
  ok: boolean;
  error?: string;
  ast?: AstNode;
  variables: string[];
  unknownVariables: string[];
}

export function validateFormula(src: string, knownVars: readonly string[]): FormulaValidation {
  try {
    const ast = compileFormula(src);
    const vars = [...listVariables(ast)];
    const known = new Set(knownVars.map((v) => v.toUpperCase()));
    const unknown = vars.filter((v) => !known.has(v));
    if (unknown.length) {
      return { ok: false, error: `Variáveis desconhecidas: ${unknown.join(", ")}`, ast, variables: vars, unknownVariables: unknown };
    }
    return { ok: true, ast, variables: vars, unknownVariables: [] };
  } catch (e) {
    return { ok: false, error: (e as Error).message, variables: [], unknownVariables: [] };
  }
}

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);