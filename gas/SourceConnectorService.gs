/**
 * Universal Source Connector — Google Sheets.
 *
 * Read-only adapter:
 * Google Spreadsheet -> header mapping -> canonical matrix -> existing ImportService.
 * It never writes to the external source spreadsheet.
 */
const GOOGLE_SOURCE_REGISTRY = Object.freeze({
  RESIDENCE_PERMIT_SERVICE_MONTHLY:Object.freeze({
    sourceKey:'RESIDENCE_PERMIT',
    datasetKey:'RESIDENCE_PERMIT_SERVICE_MONTHLY',
    spreadsheetId:'1JEGcYrfWRoCyWXXqN_TBGC4fLsF-Y10bOVZPUlkkB4'
  }),
  PASSPORT_SERVICE_MONTHLY:Object.freeze({
    sourceKey:'PASSPORT',
    datasetKey:'PASSPORT_SERVICE_MONTHLY',
    spreadsheetId:'1-eEQBLa_FK4S9uD05SGHDUnjJuN7rEEhOCE1MC3S-84'
  })
});

const SOURCE_HEADER_ALIASES_ = Object.freeze({
  PERIODE:'periode',PERIOD:'periode',BULAN:'periode',MONTH:'periode',
  KANTOR_IMIGRASI:'kantor_imigrasi',KANTOR:'kantor_imigrasi',UPT_IMIGRASI:'kantor_imigrasi',
  BVK:'bvk',VOA:'voa',ITK:'itk',ITK_PERALIHAN:'itk_peralihan',ITK_PERALIHANAN:'itk_peralihan',
  ITAS:'itas',ITAP:'itap',ITKT:'itkt',
  ALIH_STATUS_ITK_KE_ITAS:'alih_status_itk_ke_itas',ITK_KE_ITAS:'alih_status_itk_ke_itas',
  ALIH_STATUS_ITAS_KE_ITAP:'alih_status_itas_ke_itap',ITAS_KE_ITAP:'alih_status_itas_ke_itap',
  ABG:'abg',EPO:'epo',IMK:'imk',SKIM:'skim',TOTAL:'total',
  BIASA_24:'biasa_24',BIASA_24_JAM:'biasa_24',PASPOR_BIASA_24:'biasa_24',PASPOR_BIASA_24_JAM:'biasa_24',
  BIASA_48:'biasa_48',BIASA_48_JAM:'biasa_48',PASPOR_BIASA_48:'biasa_48',PASPOR_BIASA_48_JAM:'biasa_48',
  ELEKTRONIK_48:'elektronik_48',ELEKTRONIK_48_JAM:'elektronik_48',PASPOR_ELEKTRONIK_48:'elektronik_48',
  E_POLIKARBONAT:'e_polikarbonat',E_POLIKARBONAT_:'e_polikarbonat',EPOLIKARBONAT:'e_polikarbonat',
  PASPOR_E_POLIKARBONAT:'e_polikarbonat',PASPOR_E_POLIKARBONAT_:'e_polikarbonat'
});

function normalizeGoogleSpreadsheetId_(value){
  const s=String(value||'').trim();
  if(!s)throw new Error('Spreadsheet ID/URL wajib diisi.');
  const idMatch=s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id=idMatch?idMatch[1]:s;
  if(!/^[a-zA-Z0-9-_]{20,120}$/.test(id))throw new Error('Spreadsheet ID tidak valid.');
  return id;
}

function getConfiguredGoogleSource_(datasetKey){
  const key=String(datasetKey||'').trim();
  const source=GOOGLE_SOURCE_REGISTRY[key];
  if(!source)throw new Error('GOOGLE_SOURCE_NOT_CONFIGURED: '+key);
  return source;
}

function listGoogleSourceSheets(payload){
  requirePermission_('dataset.import');
  const p=payload||{},datasetKey=String(p.datasetKey||'').trim();
  const configured=getConfiguredGoogleSource_(datasetKey);
  const spreadsheetId=normalizeGoogleSpreadsheetId_(p.spreadsheetId||configured.spreadsheetId);
  const ss=SpreadsheetApp.openById(spreadsheetId);
  return {ok:true,datasetKey,spreadsheetId,spreadsheetName:ss.getName(),sheets:ss.getSheets().map(sh=>({name:sh.getName(),rows:sh.getLastRow(),columns:sh.getLastColumn()}))};
}

function normalizeSourceHeader_(value){
  return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

function canonicalizeSourceHeaders_(headers){
  const dictionary=canonicalizeHeaders_(headers);
  return headers.map((h,i)=>{
    const normalized=normalizeSourceHeader_(h);
    return SOURCE_HEADER_ALIASES_[normalized]||dictionary[i];
  });
}

function readGoogleSourceMatrix_(payload){
  const p=payload||{},datasetKey=String(p.datasetKey||'').trim(),configured=getConfiguredGoogleSource_(datasetKey);
  const spreadsheetId=normalizeGoogleSpreadsheetId_(p.spreadsheetId||configured.spreadsheetId);
  const sheetName=String(p.sheetName||'').trim();
  if(!sheetName)throw new Error('Sheet sumber wajib dipilih.');
  const ss=SpreadsheetApp.openById(spreadsheetId),sh=ss.getSheetByName(sheetName);
  if(!sh)throw new Error('SOURCE_SHEET_NOT_FOUND: '+sheetName);
  const maxRows=Math.min(APP.MAX_IMPORT_ROWS+1,Math.max(2,Number(p.maxRows)||APP.MAX_IMPORT_ROWS+1));
  const maxColumns=Math.min(100,Math.max(1,Number(p.maxColumns)||100));
  const rows=Math.min(sh.getLastRow(),maxRows),columns=Math.min(sh.getLastColumn(),maxColumns);
  if(rows<2||columns<1)throw new Error('SOURCE_SHEET_EMPTY');
  const values=sh.getRange(1,1,rows,columns).getValues();
  return {spreadsheetId,sheetName,spreadsheetName:ss.getName(),values};
}

function adaptGoogleSourceMatrix_(payload){
  const raw=readGoogleSourceMatrix_(payload),headers=raw.values[0].map(String),sourceColumns=canonicalizeSourceHeaders_(headers);
  const dup=sourceColumns.filter((c,i)=>sourceColumns.indexOf(c)!==i);
  if(dup.length)throw new Error('SOURCE_COLUMN_DUPLICATE: '+[...new Set(dup)].join(', '));
  const rows=raw.values.slice(1).filter(r=>r.some(v=>String(v)!=='')).map(r=>r.map((v,i)=>{
    if(v instanceof Date&&sourceColumns[i]==='periode')return Utilities.formatDate(v,APP.TZ,'yyyy-MM');
    return v;
  }));
  return {spreadsheetId:raw.spreadsheetId,spreadsheetName:raw.spreadsheetName,sheetName:raw.sheetName,sourceHeaders:headers,sourceColumns,rows};
}

function sourceMatrixToTsv_(headers,rows){
  const cell=v=>{
    let s=v instanceof Date?Utilities.formatDate(v,APP.TZ,'yyyy-MM'):String(v===null||v===undefined?'':v);
    if(/[\t\n\r"]/.test(s))s='"'+s.replace(/"/g,'""')+'"';
    return s;
  };
  return [headers.map(cell).join('\t')].concat(rows.map(r=>r.map(cell).join('\t'))).join('\n');
}

function previewGoogleSourceImport(payload){
  const user=requirePermission_('dataset.import'),adapted=adaptGoogleSourceMatrix_(payload),requestedDataset=String((payload||{}).datasetKey||'').trim();
  const schema=detectSchema_(adapted.sourceColumns);
  if(schema.contractKey!==schema.datasetKey||schema.datasetKey!==requestedDataset)throw new Error('SOURCE_SCHEMA_DATASET_MISMATCH: expected '+requestedDataset+', detected '+schema.datasetKey);
  const check=validateRows_(schema,adapted.rows),dataset=getDatasetBySignature_(schema.signature);
  return {
    ok:true,source:{type:'GOOGLE_SHEETS',spreadsheetId:adapted.spreadsheetId,spreadsheetName:adapted.spreadsheetName,sheetName:adapted.sheetName},
    mapping:adapted.sourceHeaders.map((header,i)=>({source:header,canonical:adapted.sourceColumns[i]})),
    schema,dataset:dataset||{datasetKey:schema.datasetKey,sheetName:APP.SHEET_PREFIX+schema.datasetKey,columns:schema.columns,rowCount:0},
    preview:check.valid.slice(0,20),validRows:check.valid.length,rejectedRows:check.errors.length,duplicates:check.duplicates,
    errors:check.errors.slice(0,50),actor:user.email
  };
}

function commitGoogleSourceImport(payload){
  requirePermission_('dataset.import');
  const adapted=adaptGoogleSourceMatrix_(payload),schema=detectSchema_(adapted.sourceColumns),requestedDataset=String((payload||{}).datasetKey||'').trim();
  if(schema.contractKey!==schema.datasetKey||schema.datasetKey!==requestedDataset)throw new Error('SOURCE_SCHEMA_DATASET_MISMATCH: expected '+requestedDataset+', detected '+schema.datasetKey);
  const result=commitImport(sourceMatrixToTsv_(adapted.sourceColumns,adapted.rows));
  appendAudit_('IMPORT_SOURCE_COMMIT',result.datasetKey,result.batchId,result.inserted,'SUCCESS',JSON.stringify({
    sourceType:'GOOGLE_SHEETS',
    spreadsheetId:adapted.spreadsheetId,
    spreadsheetName:adapted.spreadsheetName,
    sheetName:adapted.sheetName,
    sourceSchema:schema.signature,
    contractVersion:schema.contractVersion
  }));
  return result;
}
