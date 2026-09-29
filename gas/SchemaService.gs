function normalizeHeader_(value){return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
function getDictionary_(){
  const v=getDb_().getSheetByName(SHEETS.DATA_DICTIONARY).getDataRange().getValues(),h=v.shift(),i=Object.fromEntries(h.map((x,n)=>[x,n]));
  return v.filter(r=>r[0]).map(r=>({key:String(r[i.canonical_key]),label:String(r[i.display_name]),aliases:String(r[i.aliases]).split(';').map(normalizeHeader_).filter(Boolean),type:String(r[i.data_type]).toUpperCase(),required:String(r[i.required]).toUpperCase()==='TRUE',transform:String(r[i.transform]||'trim')}));
}
function canonicalizeHeaders_(headers){
  const map={};getDictionary_().forEach(d=>{map[normalizeHeader_(d.key)]=d.key;map[normalizeHeader_(d.label)]=d.key;d.aliases.forEach(a=>map[a]=d.key);});
  return headers.map(h=>map[normalizeHeader_(h)]||normalizeHeader_(h).toLowerCase());
}
function schemaSignature_(columns){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,columns.join('|'),Utilities.Charset.UTF_8)).replace(/=+$/,'');}
function detectSchema_(headers){
  const columns=canonicalizeHeaders_(headers);const dup=columns.filter((c,i)=>columns.indexOf(c)!==i);
  if(dup.length)throw new Error('Kolom duplikat: '+[...new Set(dup)].join(', '));
  const sig=schemaSignature_(columns),base=columns.slice(0,8).join('_').toUpperCase().replace(/[^A-Z0-9_]/g,'_').replace(/_+/g,'_').slice(0,70)||'IMPORT';
  return {columns,signature:sig,datasetKey:base+'_'+sig.slice(0,8).toUpperCase()};
}
