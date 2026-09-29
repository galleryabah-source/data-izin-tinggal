function getDatasetBySignature_(signature){
  const v=getDb_().getSheetByName(SHEETS.DATASET_REGISTRY).getDataRange().getValues();if(v.length<2)return null;const h=v[0],i=Object.fromEntries(h.map((x,n)=>[x,n]));
  const r=v.slice(1).find(x=>String(x[i.schema_signature])===signature&&String(x[i.status]).toUpperCase()==='ACTIVE');if(!r)return null;
  return {datasetKey:String(r[i.dataset_key]),sheetName:String(r[i.sheet_name]),signature:String(r[i.schema_signature]),columns:JSON.parse(String(r[i.columns_json])),rowCount:Number(r[i.row_count]||0)};
}
function ensureDataset_(schema,actor){
  const existing=getDatasetBySignature_(schema.signature);if(existing)return existing;const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const again=getDatasetBySignature_(schema.signature);if(again)return again;const ss=getDb_(),sheetName=APP.SHEET_PREFIX+schema.datasetKey,sh=ss.getSheetByName(sheetName)||ss.insertSheet(sheetName);if(sh.getLastRow()===0){sh.getRange(1,1,1,schema.columns.length).setValues([schema.columns]);sh.setFrozenRows(1);}
    ss.getSheetByName(SHEETS.DATASET_REGISTRY).appendRow([schema.datasetKey,sheetName,schema.signature,JSON.stringify(schema.columns),0,'ACTIVE',nowIso_(),nowIso_(),actor]);
    return {datasetKey:schema.datasetKey,sheetName,signature:schema.signature,columns:schema.columns,rowCount:0};
  }finally{lock.releaseLock();}
}
function updateDatasetRowCount_(dataset){const sh=getDb_().getSheetByName(SHEETS.DATASET_REGISTRY),v=sh.getDataRange().getValues(),h=v[0],i=Object.fromEntries(h.map((x,n)=>[x,n])),n=v.findIndex(r=>String(r[i.dataset_key])===dataset.datasetKey);if(n<1)return;sh.getRange(n+1,i.row_count+1).setValue(dataset.rowCount);sh.getRange(n+1,i.updated_at+1).setValue(nowIso_());}
function listDatasets(){requirePermission_('dataset.read');const v=getDb_().getSheetByName(SHEETS.DATASET_REGISTRY).getDataRange().getValues();return v.length<2?[]:v.slice(1).filter(r=>String(r[5]).toUpperCase()==='ACTIVE').map(r=>({datasetKey:String(r[0]),sheetName:String(r[1]),signature:String(r[2]),columns:JSON.parse(String(r[3])),rowCount:Number(r[4]||0),status:String(r[5])}));}
