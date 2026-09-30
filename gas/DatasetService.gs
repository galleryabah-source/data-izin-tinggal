function getDatasetBySignature_(signature){
  const snapshot=getDatasetRegistrySnapshot_();
  const matches=snapshot.rows.map((row,n)=>({row,rowNumber:n+2,status:String(row[snapshot.index.status]||'').trim().toUpperCase()}))
    .filter(x=>x.status==='ACTIVE'&&String(x.row[snapshot.index.schema_signature]||'').trim()===String(signature||'').trim());
  if(matches.length>1)throw new Error('DATASET_IDENTITY_CONFLICT: duplicate active schema signature '+signature);
  if(!matches.length)return null;
  const identity=getCanonicalDatasetIdentity_(matches[0].row,snapshot.index);
  const sameKey=snapshot.rows.map((row,n)=>({row,rowNumber:n+2,status:String(row[snapshot.index.status]||'').trim().toUpperCase()}))
    .filter(x=>x.status==='ACTIVE'&&String(x.row[snapshot.index.dataset_key]||'').trim()===identity.datasetKey);
  if(sameKey.length!==1)throw new Error('DATASET_IDENTITY_CONFLICT: active dataset_key '+identity.datasetKey+' has '+sameKey.length+' records.');
  return identity;
}
function ensureDataset_(schema,actor){
  const existing=getDatasetBySignature_(schema.signature);if(existing)return existing;const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const again=getDatasetBySignature_(schema.signature);if(again)return again;
    const snapshot=getDatasetRegistrySnapshot_();
    const conflicting=snapshot.rows.map((row,n)=>({row,rowNumber:n+2,status:String(row[snapshot.index.status]||'').trim().toUpperCase()}))
      .filter(x=>x.status==='ACTIVE'&&String(x.row[snapshot.index.dataset_key]||'').trim()===schema.datasetKey);
    if(conflicting.length)throw new Error('DATASET_IDENTITY_CONFLICT: active dataset_key already exists with a different identity: '+schema.datasetKey);
    const ss=getDb_(),sheetName=APP.SHEET_PREFIX+schema.datasetKey,sh=ss.getSheetByName(sheetName);
    if(sh){
      const header=sh.getLastRow()?sh.getRange(1,1,1,schema.columns.length).getValues()[0].map(String):[];
      if(header.length&&JSON.stringify(header)!==JSON.stringify(schema.columns))throw new Error('DATASET_IDENTITY_SHEET_DRIFT: '+sheetName);
      if(sh.getLastRow()>1)throw new Error('DATASET_IDENTITY_ORPHAN_SHEET: '+sheetName);
    }
    const target=sh||ss.insertSheet(sheetName);
    if(target.getLastRow()===0){target.getRange(1,1,1,schema.columns.length).setValues([schema.columns]);target.setFrozenRows(1);}
    ss.getSheetByName(SHEETS.DATASET_REGISTRY).appendRow([schema.datasetKey,sheetName,schema.signature,JSON.stringify(schema.columns),0,'ACTIVE',nowIso_(),nowIso_(),actor]);
    return {datasetKey:schema.datasetKey,sheetName,signature:schema.signature,columns:schema.columns,rowCount:0};
  }finally{lock.releaseLock();}
}
function updateDatasetRowCount_(dataset){
  const snapshot=getDatasetRegistrySnapshot_();
  const matches=snapshot.rows.map((row,n)=>({row,rowNumber:n+2,status:String(row[snapshot.index.status]||'').trim().toUpperCase()}))
    .filter(x=>x.status==='ACTIVE'&&String(x.row[snapshot.index.dataset_key]||'').trim()===dataset.datasetKey&&String(x.row[snapshot.index.schema_signature]||'').trim()===dataset.signature);
  if(matches.length!==1)throw new Error('DATASET_IDENTITY_CONFLICT: cannot update row_count for '+dataset.datasetKey+' / '+dataset.signature);
  const identity=getCanonicalDatasetIdentity_(matches[0].row,snapshot.index);
  const sh=snapshot.sheet;
  sh.getRange(matches[0].rowNumber,snapshot.index.row_count+1).setValue(identity.rowCount);
  sh.getRange(matches[0].rowNumber,snapshot.index.updated_at+1).setValue(nowIso_());
}
function listDatasets(){
  requirePermission_('dataset.read');
  const snapshot=getDatasetRegistrySnapshot_();
  return snapshot.rows.map((row,n)=>({row,rowNumber:n+2,status:String(row[snapshot.index.status]||'').trim().toUpperCase()}))
    .filter(x=>x.status==='ACTIVE')
    .map(x=>getCanonicalDatasetIdentity_(x.row,snapshot.index))
    .map(identity=>({datasetKey:identity.datasetKey,sheetName:identity.sheetName,signature:identity.signature,columns:identity.columns,rowCount:identity.rowCount,status:identity.status}));
}
