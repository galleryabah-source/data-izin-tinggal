'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const gasDir = __dirname;
const sources = new Map(fs.readdirSync(gasDir).filter(n => n.endsWith('.gs')).map(n => [n, fs.readFileSync(path.join(gasDir,n),'utf8')]));

function stripComments(s) {
  let o='', state='code', q='';
  for(let i=0;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(state==='line'){if(c==='\n'){state='code';o+='\n';}else o+=' ';continue;}
    if(state==='block'){if(c==='*'&&n==='/'){o+='  ';i++;state='code';}else o+=c==='\n'?'\n':' ';continue;}
    if(state==='str'){o+=c;if(c==='\\'){if(i+1<s.length)o+=s[++i];continue;}if(c===q)state='code';continue;}
    if(c==='/'&&n==='/'){o+='  ';i++;state='line';continue;}
    if(c==='/'&&n==='*'){o+='  ';i++;state='block';continue;}
    if(c==="'"||c==='"'||c.charCodeAt(0)===96){q=c;state='str';}
    o+=c;
  }
  return o;
}
function bodyAt(s,start){
  let d=0,state='code',q='',inClass=false;
  for(let i=start;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(state==='line'){if(c==='\n')state='code';continue;}
    if(state==='block'){if(c==='*'&&n==='/'){i++;state='code';}continue;}
    if(state==='str'){if(c==='\\'){i++;continue;}if(c===q)state='code';continue;}
    if(state==='regex'){
      if(c==='\\'){i++;continue;}
      if(c==='[')inClass=true;else if(c===']')inClass=false;else if(c==='/'&&!inClass)state='code';
      continue;
    }
    if(c==='/'&&n==='/'){i++;state='line';continue;}
    if(c==='/'&&n==='*'){i++;state='block';continue;}
    if(c==="'"||c==='"'||c.charCodeAt(0)===96){q=c;state='str';continue;}
    if(c==='/'){
      const prefix=s.slice(0,i).trimEnd();
      const previous=prefix.slice(-1);
      if(/[=(:,;!?{[|&]/.test(previous)||/\\b(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await)\\s*$/.test(prefix)){
        state='regex';inClass=false;continue;
      }
    }
    if(c==='{')d++;
    if(c==='}'&&--d===0)return s.slice(start+1,i);
  }
  throw new Error('Unbalanced function body');
}
function extract(s){
  const clean=stripComments(s),out=new Map(),re=/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while((m=re.exec(clean))!==null){
    let i=re.lastIndex,p=1,state='code',q='';
    for(;i<clean.length&&p>0;i++){
      const c=clean[i];
      if(state==='str'){if(c==='\\'){i++;continue;}if(c===q)state='code';continue;}
      if(c==="'"||c==='"'||c.charCodeAt(0)===96){q=c;state='str';continue;}
      if(c==='(')p++;if(c===')')p--;
    }
    const b=clean.indexOf('{',i);
    assert.notEqual(b,-1,'Function has opening brace: '+m[1]);
    out.set(m[1],bodyAt(s,b));
  }
  return out;
}
const funcs=new Map();
for(const [file,src] of sources)for(const [name,body] of extract(src)){
  assert(!funcs.has(name),'Unique function declaration: '+name);
  funcs.set(name,{file,body:stripComments(body)});
}
const manifest=require('./RpcManifest.js').RPC_MANIFEST_V1;
const declared=new Set([...funcs.keys()].filter(n=>!n.endsWith('_')));
assert.deepEqual([...declared].filter(n=>!Object.hasOwn(manifest,n)),[],'All callable functions are classified');
assert.deepEqual(Object.keys(manifest).filter(n=>!declared.has(n)),[],'Manifest has no stale functions');

function reachable(root){
  const seen=new Set(),queue=[root];
  while(queue.length){
    const n=queue.shift();if(seen.has(n)||!funcs.has(n))continue;seen.add(n);
    for(const m of funcs.get(n).body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g))
      if(funcs.has(m[1])&&!seen.has(m[1]))queue.push(m[1]);
  }
  return [...seen].map(n=>({name:n,...funcs.get(n)}));
}
for(const [name,policy] of Object.entries(manifest)){
  const graph=reachable(name);assert(graph.length,'RPC function body exists: '+name);
  const code=graph.map(x=>x.body).join('\n');
  if(policy.access==='protected'){
    const p=policy.permission.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
    const re=policy.permission==='backoffice.access'?/\brequireBackOfficeAccess_\s*\(\s*\)/:new RegExp("\\brequirePermission_\\s*\\(\\s*(['\\\"])"+p+"\\1\\s*\\)");
    assert(re.test(code),'Reachable guard matches '+policy.permission+': '+name);
  }
  if(policy.access==='public_read_only'){
    assert(!/\.(?:appendRow|setValue|setValues|deleteRow|insertRow|insertSheet|deleteSheet|clear|clearContent|clearContents|setFormula|setFormulas|copyTo|moveTo)\s*\(/.test(code),'Public RPC call graph has no known Spreadsheet mutation: '+name);
    assert(!/\b(?:commitImport|appendAudit_|adminCreateUser|saveRunningText|deleteRunningText|closePeriod|reopenPeriod)\s*\(/.test(code),'Public RPC does not reach known mutation services: '+name);
  }
  if(policy.access==='self_scope')assert(/\bgetCurrentUser_\s*\(/.test(code),'Self-scope RPC resolves current principal: '+name);
}
console.log('RPC security contract passed: '+declared.size+' callable functions, '+Object.keys(manifest).length+' manifest entries.');
