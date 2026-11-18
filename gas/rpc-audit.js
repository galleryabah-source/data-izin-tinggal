'use strict';

/**
 * Constrained source inventory for Apps Script RPC review.
 *
 * This is deliberately NOT an authorization proof or a complete ECMAScript AST.
 * It tokenizes comments/strings safely, extracts classic function declarations,
 * balances function bodies, and records statically named calls to declared functions.
 * Unsupported constructs are reported so callers can fail closed rather than infer safety.
 */

const CONTROL_CALLS = new Set([
  'if','for','while','switch','catch','with','function','return','typeof','new',
  'throw','delete','void','await','yield','super'
]);

function tokenize(source) {
  const tokens = [];
  const unsupported = [];
  let i = 0;
  const push = (type, value, start, end) => tokens.push({ type, value, start, end });
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && source[i + 1] === '/') {
      i += 2; while (i < source.length && source[i] !== '\n') i++; continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) { unsupported.push('UNTERMINATED_BLOCK_COMMENT'); break; }
      i = end + 2; continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch, start = i++;
      let closed = false;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === quote) { i++; closed = true; break; }
        if (source[i] === '\n' && quote !== '`') break;
        i++;
      }
      if (!closed) unsupported.push('UNTERMINATED_STRING');
      push('string', '<string>', start, i); continue;
    }
    if (ch === '`') {
      const start = i++;
      let closed = false, interpolation = false;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '$' && source[i + 1] === '{') interpolation = true;
        if (source[i] === '`') { i++; closed = true; break; }
        i++;
      }
      if (!closed) unsupported.push('UNTERMINATED_TEMPLATE');
      if (interpolation) unsupported.push('TEMPLATE_INTERPOLATION_NOT_ANALYZED');
      push('template', '<template>', start, i); continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[\w$]/.test(source[i])) i++;
      push('id', source.slice(start, i), start, i); continue;
    }
    if (/[0-9]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[\w.]/.test(source[i])) i++;
      push('number', source.slice(start, i), start, i); continue;
    }
    push('punct', ch, i, i + 1); i++;
  }
  return { tokens, unsupported };
}

function extractFunctions(source) {
  const { tokens, unsupported } = tokenize(source);
  const functions = new Map();
  const matching = (start, open, close) => {
    let depth = 0;
    for (let j = start; j < tokens.length; j++) {
      if (tokens[j].value === open) depth++;
      if (tokens[j].value === close && --depth === 0) return j;
    }
    return -1;
  };
  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i].value !== 'function') continue;
    let nameIndex = i + 1;
    if (tokens[nameIndex] && tokens[nameIndex].value === '*') nameIndex++;
    const nameToken = tokens[nameIndex];
    if (!nameToken || nameToken.type !== 'id') continue;
    let openParen = nameIndex + 1;
    while (openParen < tokens.length && tokens[openParen].value !== '(' && tokens[openParen].value !== '{') openParen++;
    if (!tokens[openParen] || tokens[openParen].value !== '(') continue;
    const closeParen = matching(openParen, '(', ')');
    if (closeParen < 0 || !tokens[closeParen + 1] || tokens[closeParen + 1].value !== '{') {
      unsupported.push('FUNCTION_BODY_NOT_STATIC:' + nameToken.value); continue;
    }
    const openBrace = closeParen + 1;
    const closeBrace = matching(openBrace, '{', '}');
    if (closeBrace < 0) { unsupported.push('UNBALANCED_FUNCTION_BODY:' + nameToken.value); continue; }
    const bodyTokens = tokens.slice(openBrace + 1, closeBrace);
    const calls = new Set();
    for (let j = 0; j < bodyTokens.length - 1; j++) {
      const token = bodyTokens[j], next = bodyTokens[j + 1];
      if (token.type === 'id' && next.value === '(' && !CONTROL_CALLS.has(token.value)) {
        calls.add(token.value);
      }
    }
    const bodyText = source.slice(tokens[openBrace].end, tokens[closeBrace].start);
    functions.set(nameToken.value, {
      name: nameToken.value,
      start: tokens[i].start,
      end: tokens[closeBrace].end,
      bodyText,
      calls: [...calls]
    });
    i = closeBrace;
  }
  return { functions, unsupported: [...new Set(unsupported)] };
}

function analyzeCallGraph(sources) {
  const functions = new Map();
  const unsupported = [];
  for (const [file, source] of Object.entries(sources)) {
    const parsed = extractFunctions(source);
    unsupported.push(...parsed.unsupported.map(reason => file + ':' + reason));
    for (const [name, fn] of parsed.functions) {
      if (functions.has(name)) unsupported.push('AMBIGUOUS_FUNCTION:' + name);
      else functions.set(name, { ...fn, file });
    }
  }
  for (const fn of functions.values()) {
    fn.edges = fn.calls.filter(name => functions.has(name));
  }
  return { functions, unsupported: [...new Set(unsupported)] };
}

function reachableFunctions(graph, entryName) {
  if (!graph.functions.has(entryName)) return { names: [], unresolved: [entryName] };
  const seen = new Set(), unresolved = new Set(), queue = [entryName];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const fn = graph.functions.get(name);
    for (const call of fn.calls) {
      if (graph.functions.has(call)) queue.push(call);
      else if (!CONTROL_CALLS.has(call)) unresolved.add(call);
    }
  }
  return { names: [...seen], unresolved: [...unresolved] };
}

module.exports = { tokenize, extractFunctions, analyzeCallGraph, reachableFunctions };
