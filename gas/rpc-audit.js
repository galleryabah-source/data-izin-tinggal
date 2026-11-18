'use strict';

/**
 * Constrained source inventory for Apps Script RPC review.
 * Not a complete ECMAScript parser or authorization proof.
 * Unsupported syntax is surfaced rather than treated as safe.
 */
const CONTROL_CALLS = new Set([
  'if','for','while','switch','catch','with','function','return','typeof','new',
  'throw','delete','void','await','yield','super'
]);
const REGEX_PREFIX_KEYWORDS = new Set([
  'return','throw','case','delete','void','typeof','instanceof','in','of','yield','await'
]);

function tokenize(source) {
  const tokens = [], unsupported = [];
  let i = 0;
  const push = (type, value, start, end) => tokens.push({ type, value, start, end });
  const regexMayStart = () => {
    const prev = tokens[tokens.length - 1];
    if (!prev) return true;
    if (prev.type === 'id') return REGEX_PREFIX_KEYWORDS.has(prev.value);
    if (prev.type === 'punct') return ['(','{','[',',',':','=','!','?',';','&','|','+','-','*','%','~'].includes(prev.value);
    return false;
  };
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
    if (ch === '/' && regexMayStart()) {
      const start = i++;
      let inClass = false, closed = false;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '[') inClass = true;
        else if (source[i] === ']') inClass = false;
        else if (source[i] === '/' && !inClass) { i++; closed = true; break; }
        else if (source[i] === '\n') break;
        i++;
      }
      if (!closed) unsupported.push('UNTERMINATED_OR_AMBIGUOUS_REGEX_LITERAL');
      while (i < source.length && /[A-Za-z]/.test(source[i])) i++;
      push('regex', '<regex>', start, i); continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch, start = i++;
      let closed = false;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === quote) { i++; closed = true; break; }
        if (source[i] === '\n') break;
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
    const openBrace = closeParen + 1, closeBrace = matching(openBrace, '{', '}');
    if (closeBrace < 0) { unsupported.push('UNBALANCED_FUNCTION_BODY:' + nameToken.value); continue; }
    const bodyTokens = tokens.slice(openBrace + 1, closeBrace), calls = new Set();
    for (let j = 0; j < bodyTokens.length - 1; j++) {
      const token = bodyTokens[j], next = bodyTokens[j + 1];
      if (token.type === 'id' && next.value === '(' && !CONTROL_CALLS.has(token.value)) calls.add(token.value);
    }
    for (let j = 0; j < bodyTokens.length - 2; j++) {
      if (bodyTokens[j].value === ']' && bodyTokens[j + 1].value === '(')
        unsupported.push('COMPUTED_CALL_NOT_ANALYZED:' + nameToken.value);
    }
    for (const call of calls) {
      if (call === 'eval' || call === 'Function') unsupported.push('DYNAMIC_CODE_EXECUTION:' + nameToken.value + ':' + call);
    }
    functions.set(nameToken.value, {
      name: nameToken.value, start: tokens[i].start, end: tokens[closeBrace].end,
      bodyText: source.slice(tokens[openBrace].end, tokens[closeBrace].start),
      calls: [...calls]
    });
    i = closeBrace;
  }
  return { functions, unsupported: [...new Set(unsupported)] };
}

function analyzeCallGraph(sources) {
  const functions = new Map(), unsupported = [];
  for (const [file, source] of Object.entries(sources)) {
    const parsed = extractFunctions(source);
    unsupported.push(...parsed.unsupported.map(reason => file + ':' + reason));
    for (const [name, fn] of parsed.functions) {
      if (functions.has(name)) unsupported.push('AMBIGUOUS_FUNCTION:' + name);
      else functions.set(name, { ...fn, file });
    }
  }
  for (const fn of functions.values()) fn.edges = fn.calls.filter(name => functions.has(name));
  return { functions, unsupported: [...new Set(unsupported)] };
}

function reachableFunctions(graph, entryName) {
  if (!graph.functions.has(entryName)) return { names: [], unresolved: [entryName] };
  const seen = new Set(), unresolved = new Set(), queue = [entryName];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    for (const call of graph.functions.get(name).calls) {
      if (graph.functions.has(call)) queue.push(call);
      else if (!CONTROL_CALLS.has(call)) unresolved.add(call);
    }
  }
  return { names: [...seen], unresolved: [...unresolved] };
}

const MUTATION_CALLS = new Set([
  'appendRow','appendRows','setValue','setValues','clear','clearContent','clearContents',
  'deleteRow','deleteRows','insertRow','insertRows','insertSheet','deleteSheet',
  'setProperty','deleteProperty','createFile','createFolder','moveTo','remove',
  'setSharing','addEditor','addEditors','removeEditor','removeEditors','sendEmail'
]);
const EXTERNAL_IO_CALLS = new Set(['fetch','fetchAll','sendEmail']);

function collectReachableEffects(graph, entryName) {
  const reachable = reachableFunctions(graph, entryName);
  const mutations = [], externalIo = [], unresolved = reachable.unresolved.slice();
  for (const name of reachable.names) {
    const fn = graph.functions.get(name);
    const parsed = tokenize(fn.bodyText);
    for (let i = 0; i < parsed.tokens.length - 1; i++) {
      const token = parsed.tokens[i], next = parsed.tokens[i + 1];
      if (token.type !== 'id' || next.value !== '(') continue;
      if (MUTATION_CALLS.has(token.value)) mutations.push({ functionName: name, call: token.value, file: fn.file });
      if (EXTERNAL_IO_CALLS.has(token.value)) externalIo.push({ functionName: name, call: token.value, file: fn.file });
    }
    unresolved.push(...parsed.unsupported.map(reason => name + ':' + reason));
  }
  const uniqueUnresolved = [...new Set(unresolved)];
  const blockers = uniqueUnresolved.filter(reason =>
    /COMPUTED_CALL_NOT_ANALYZED|DYNAMIC_CODE_EXECUTION|TEMPLATE_INTERPOLATION_NOT_ANALYZED|UNTERMINATED_|UNBALANCED_|FUNCTION_BODY_NOT_STATIC/.test(reason)
  );
  return {
    reachable: reachable.names,
    unresolved: uniqueUnresolved,
    blockers,
    mutations,
    externalIo
  };
}

module.exports = { tokenize, extractFunctions, analyzeCallGraph, reachableFunctions, collectReachableEffects };
