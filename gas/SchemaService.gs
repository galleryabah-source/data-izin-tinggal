function normalizeHeader_(value){return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
function getDictionary_(){
  const v=getDb_().getSheetByName(SHEETS.DATA_DICTIONARY).getDataRange().getValues(),h=v.shift(),i=Object.fromEntries(h.map((x,n)=>[x,n]));
  return v.filter(r=>r[i.canonical_key]).map(r=>({key:String(r[i.canonical_key]),label:String(r[i.display_name]),aliases:String(r[i.aliases]||'').split(';').map(normalizeHeader_).filter(Boolean),type:String(r[i.data_type]).toUpperCase(),required:String(r[i.required]).toUpperCase()==='TRUE',transform:String(r[i.transform]||'trim')}));
}
function canonicalizeHeaders_(headers){
  const map={};getDictionary_().forEach(d=>{map[normalizeHeader_(d.key)]=d.key;map[normalizeHeader_(d.label)]=d.key;d.aliases.forEach(a=>map[a]=d.key);});
  return headers.map(h=>map[normalizeHeader_(h)]||normalizeHeader_(h).toLowerCase());
}
function schemaSignature_(columns,identity){
  const legacy=!identity||!identity.periodGrain||String(identity.periodGrain)==='month';
  const material=legacy?columns.join('|'):String(identity.datasetKey)+'|v'+String(identity.version)+'|grain:'+String(identity.periodGrain)+'|'+columns.join('|');
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,material,Utilities.Charset.UTF_8)).replace(/=+$/,'');
}
function inferPeriodGrain_(headers,rows){
  const columns=canonicalizeHeaders_(headers).filter(Boolean),index=columns.indexOf('periode');
  if(index<0)return null;
  const sample=(rows||[]).map(r=>r&&r[index]).find(v=>String(v??'').trim()!=='');
  if(sample instanceof Date)return 'month';
  const s=String(sample??'').trim();
  if(/^\d{4}$/.test(s))return 'year';
  if(/^\d{4}[-/]\d{1,2}$/.test(s))return 'month';
  return null;
}
function getContractForColumns_(columns,periodGrain){
  const matches=Object.keys(DATASET_CONTRACTS).map(k=>DATASET_CONTRACTS[k]).filter(c=>{
    const set={};columns.forEach(x=>set[x]=true);
    return (!periodGrain||c.periodGrain===periodGrain) && c.required.every(x=>set[x]) && columns.every(x=>c.columns.includes(x)||c.ignored.includes(x));
  });
  if(matches.length>1&&periodGrain)return matches[0];
  return matches[0]||null;
}
function detectSchema_(headers,sampleRows){
  const inputColumns=canonicalizeHeaders_(headers).filter(Boolean),dup=inputColumns.filter((c,i)=>inputColumns.indexOf(c)!==i);
  if(dup.length)throw new Error('Kolom duplikat: '+[...new Set(dup)].join(', '));
  const periodGrain=inferPeriodGrain_(headers,sampleRows),contract=getContractForColumns_(inputColumns,periodGrain)||getContractForColumns_(inputColumns),columns=contract?contract.columns:inputColumns;
  const sig=schemaSignature_(columns,contract),base=contract?contract.datasetKey:columns.slice(0,8).join('_').toUpperCase().replace(/[^A-Z0-9_]/g,'_').replace(/_+/g,'_').slice(0,70)||'IMPORT';
  return {columns,sourceColumns:inputColumns,signature:sig,datasetKey:base,contractKey:contract?contract.datasetKey:null,contractVersion:contract?contract.version:null,periodGrain:contract?contract.periodGrain:(periodGrain||'unknown')};
}
