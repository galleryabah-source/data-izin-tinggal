function parseDelimited_(text){
  const raw=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(x=>x.trim()!=='');
  if(!raw.length)throw new Error('Data kosong.');
  const sample=raw.slice(0,5).join('\n'),counts={tab:(sample.match(/\t/g)||[]).length,semi:(sample.match(/;/g)||[]).length,comma:(sample.match(/,/g)||[]).length};
  const key=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0],delimiter={tab:'\t',semi:';',comma:','}[key]||'\t';
  return raw.map(line=>parseDelimitedLine_(line,delimiter));
}
function parseDelimitedLine_(line,delimiter){
  const out=[],buf=[];let quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(quoted&&line[i+1]==='"'){buf.push('"');i++;}else quoted=!quoted;continue;}
    if(ch===delimiter&&!quoted){out.push(buf.join('').trim());buf.length=0;continue;}
    buf.push(ch);
  }
  out.push(buf.join('').trim());return out;
}
function normalizePeriod_(value){
  const s=String(value||'').trim().toUpperCase().replace(/\s+/g,' ');
  if(/^[0-9]{4}-[0-9]{2}$/.test(s))return s;
  const m=s.match(/^(JAN|JANUARI|FEB|FEBRUARI|MAR|MARET|APR|APRIL|MEI|MAY|JUN|JUNI|JUL|JULI|AGU|AGS|AGUST|AGUSTUS|SEP|SEPT|SEPTEMBER|OKT|OKTOBER|NOV|NOVEMBER|DES|DESEMBER)[ -](20[0-9]{2})$/);
  const names={JAN:'01',JANUARI:'01',FEB:'02',FEBRUARI:'02',MAR:'03',MARET:'03',APR:'04',APRIL:'04',MEI:'05',MAY:'05',JUN:'06',JUNI:'06',JUL:'07',JULI:'07',AGU:'08',AGS:'08',AGUST:'08',AGUSTUS:'08',SEP:'09',SEPT:'09',SEPTEMBER:'09',OKT:'10',OKTOBER:'10',NOV:'11',NOVEMBER:'11',DES:'12',DESEMBER:'12'};
  if(m)return m[2]+'-'+names[m[1]];
  const n=s.match(/^([0-9]{1,2})[-/]((20)[0-9]{2})$/);if(n&&Number(n[1])>=1&&Number(n[1])<=12)return n[2]+'-'+('0'+n[1]).slice(-2);
  throw new Error('Periode harus berupa YYYY-MM atau nama bulan + tahun.');
}
function normalizeInteger_(value,key){
  const s=String(value===null||value===undefined?'':value).trim();if(s==='')throw new Error(key+' wajib diisi.');
  const n=Number(s.replace(/,/g,''));if(!Number.isFinite(n)||!Number.isInteger(n)||n<0)throw new Error(key+' harus bilangan bulat >= 0.');return n;
}
function validateRows_(schema,rows){
  if(rows.length>APP.MAX_IMPORT_ROWS)throw new Error('Maksimum '+APP.MAX_IMPORT_ROWS+' baris per import.');
  const errors=[],valid=[],duplicateRows=[];
  const contract=schema.contractKey?DATASET_CONTRACTS[schema.contractKey]:null;
  const inputColumns=schema.sourceColumns||schema.columns;
  const positions=Object.fromEntries(inputColumns.map((c,i)=>[c,i]));
  if(contract){
    const missing=contract.required.filter(k=>!inputColumns.includes(k));if(missing.length)throw new Error('Kolom wajib contract v'+contract.version+' belum tersedia: '+missing.join(', '));
  }else{
    const required=getDictionary_().filter(d=>d.required).map(d=>d.key),missing=required.filter(k=>!schema.columns.includes(k));
    if(missing.length)throw new Error('Kolom wajib belum tersedia: '+missing.join(', '));
  }
  const seen={};
  let existing={};
  if(contract){
    const dataset=getDatasetBySignature_(schema.signature);
    if(dataset){
      const sh=getDb_().getSheetByName(dataset.sheetName),values=sh.getDataRange().getValues(),header=values[0]||[],hi=Object.fromEntries(header.map((x,i)=>[x,i])),pi=hi.periode,oi=hi.kantor_imigrasi;
      if(pi!==undefined&&oi!==undefined)values.slice(1).forEach(r=>{existing[String(r[pi])+'|'+String(r[oi]).trim().toUpperCase()]=true;});
    }
  }
  rows.forEach((r,n)=>{
    const rowNumber=n+2;if(r.length!==inputColumns.length){errors.push({row:rowNumber,error:'Jumlah kolom tidak sesuai'});return;}
    try{
      let out;
      if(contract){
        out=contract.columns.map(key=>{
          if(contract.derived.includes(key))return null;
          const raw=r[positions[key]];
          if(key==='periode')return normalizePeriod_(raw);
          if(key==='kantor_imigrasi')return String(raw||'').trim();
          return normalizeInteger_(raw,key);
        });
        if(!out[contract.columns.indexOf('kantor_imigrasi')])throw new Error('kantor_imigrasi wajib diisi.');
        const derivedTotalKey=contract.derived.find(k=>k==='total'),measureKeys=contract.measures||contract.columns.filter(k=>!contract.businessKey.includes(k)&&!contract.derived.includes(k));
        const total=measureKeys.reduce((sum,key)=>sum+Number(out[contract.columns.indexOf(key)]||0),0);
        if(derivedTotalKey){
          const totalPosition=positions[derivedTotalKey],provided=totalPosition===undefined||String(r[totalPosition]||'').trim()===''?null:normalizeInteger_(r[totalPosition],derivedTotalKey);
          if(provided!==null&&provided!==total)throw new Error('total tidak cocok; expected '+total+', received '+provided+'.');
          out[contract.columns.indexOf(derivedTotalKey)]=total;
        }
        const key=out[0]+'|'+out[1].trim().toUpperCase();
        if(seen[key]||existing[key]){duplicateRows.push(rowNumber);errors.push({row:rowNumber,error:'Duplikat business key: '+key});return;}
        seen[key]=true;
      }else out=r;
      valid.push(out);
    }catch(e){errors.push({row:rowNumber,error:String(e.message||e)});}
  });
  return {valid,errors,duplicates:duplicateRows.length};
}
function previewImport(pastedText){
  const user=requirePermission_('dataset.import'),matrix=parseDelimited_(pastedText);if(matrix.length<2)throw new Error('Header dan minimal satu baris data diperlukan.');
  const schema=detectSchema_(matrix[0]),check=validateRows_(schema,matrix.slice(1)),dataset=getDatasetBySignature_(schema.signature);
  return {ok:true,dataset:dataset||{datasetKey:schema.datasetKey,sheetName:APP.SHEET_PREFIX+schema.datasetKey,columns:schema.columns,rowCount:0},schema,preview:check.valid.slice(0,20),validRows:check.valid.length,rejectedRows:check.errors.length,duplicates:check.duplicates,errors:check.errors.slice(0,50),actor:user.email};
}
function commitImport(pastedText){
  const user=requirePermission_('dataset.import'),matrix=parseDelimited_(pastedText);if(matrix.length<2)throw new Error('Header dan minimal satu baris data diperlukan.');
  const schema=detectSchema_(matrix[0]),check=validateRows_(schema,matrix.slice(1));if(!check.valid.length)throw new Error('Tidak ada baris valid untuk diimpor.');
  const dataset=ensureDataset_(schema,user.email),sh=getDb_().getSheetByName(dataset.sheetName),batchId=Utilities.getUuid(),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const start=sh.getLastRow()+1;sh.getRange(start,1,check.valid.length,schema.columns.length).setValues(check.valid);
    dataset.rowCount=sh.getLastRow()-1;updateDatasetRowCount_(dataset);
    getDb_().getSheetByName(SHEETS.IMPORT_LOG).appendRow([batchId,nowIso_(),user.email,dataset.datasetKey,schema.contractVersion||'1',matrix.length-1,check.valid.length,check.errors.length,check.duplicates,'SUCCESS',check.errors.slice(0,10).map(x=>x.error).join('; ')]);
    appendAudit_('IMPORT_COMMIT',dataset.datasetKey,batchId,check.valid.length,'SUCCESS',JSON.stringify({rejected:check.errors.length,duplicates:check.duplicates,contractVersion:schema.contractVersion}));
    return {ok:true,batchId,datasetKey:dataset.datasetKey,inserted:check.valid.length,rejected:check.errors.length,duplicates:check.duplicates,rowCount:dataset.rowCount};
  }finally{lock.releaseLock();}
}
