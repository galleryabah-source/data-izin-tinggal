function parseDelimited_(text){
  const lines=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(x=>x.trim()!=='');
  if(!lines.length)throw new Error('Data kosong.');
  const sample=lines.slice(0,5).join('\n'),counts={tab:(sample.match(/\t/g)||[]).length,semi:(sample.match(/;/g)||[]).length,comma:(sample.match(/,/g)||[]).length};
  const delim=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];const d={tab:'\t',semi:';',comma:','}[delim]||'\t';
  return lines.map(line=>line.split(d).map(v=>String(v).trim()));
}
function validateRows_(columns,rows){
  if(rows.length>APP.MAX_IMPORT_ROWS)throw new Error('Maksimum '+APP.MAX_IMPORT_ROWS+' baris per import.');
  const dictionary=getDictionary_(),required=dictionary.filter(d=>d.required).map(d=>d.key);
  const missing=required.filter(k=>!columns.includes(k));
  if(missing.length)throw new Error('Kolom wajib belum tersedia: '+missing.join(', '));
  const errors=[],valid=[];
  rows.forEach((r,n)=>{if(r.length!==columns.length){errors.push({row:n+2,error:'Jumlah kolom tidak sesuai'});return;}valid.push(r);});
  return {valid,errors};
}
function previewImport(pastedText){
  const user=requirePermission_('dataset.import'),matrix=parseDelimited_(pastedText);
  const schema=detectSchema_(matrix[0]),check=validateRows_(schema.columns,matrix.slice(1));
  const dataset=getDatasetBySignature_(schema.signature);
  return {ok:true,dataset:dataset||{datasetKey:schema.datasetKey,sheetName:APP.SHEET_PREFIX+schema.datasetKey,columns:schema.columns,rowCount:0},schema,preview:check.valid.slice(0,20),validRows:check.valid.length,rejectedRows:check.errors.length,errors:check.errors.slice(0,50),actor:user.email};
}
function commitImport(pastedText){
  const user=requirePermission_('dataset.import'),matrix=parseDelimited_(pastedText),schema=detectSchema_(matrix[0]),check=validateRows_(schema.columns,matrix.slice(1));
  if(!check.valid.length)throw new Error('Tidak ada baris valid untuk diimpor.');
  const dataset=ensureDataset_(schema,user.email),sh=getDb_().getSheetByName(dataset.sheetName),batchId=Utilities.getUuid(),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const start=sh.getLastRow()+1;sh.getRange(start,1,check.valid.length,schema.columns.length).setValues(check.valid);
    dataset.rowCount=sh.getLastRow()-1;updateDatasetRowCount_(dataset);
    getDb_().getSheetByName(SHEETS.IMPORT_LOG).appendRow([batchId,nowIso_(),user.email,dataset.datasetKey,'1',check.valid.length,check.valid.length,check.errors.length,0,'SUCCESS',check.errors.slice(0,10).map(x=>x.error).join('; ')]);
    appendAudit_('IMPORT_COMMIT',dataset.datasetKey,batchId,check.valid.length,'SUCCESS',JSON.stringify({rejected:check.errors.length}));
    return {ok:true,batchId,datasetKey:dataset.datasetKey,inserted:check.valid.length,rejected:check.errors.length,rowCount:dataset.rowCount};
  }finally{lock.releaseLock();}
}
