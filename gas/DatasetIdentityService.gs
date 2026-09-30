function getDatasetRegistrySnapshot_(){
  const sheet=getDb_().getSheetByName(SHEETS.DATASET_REGISTRY);
  if(!sheet)throw new Error('DATASET_REGISTRY_NOT_FOUND');
  const values=sheet.getDataRange().getValues(),header=values[0]||[];
  const index=Object.fromEntries(header.map((x,n)=>[x,n]));
  const required=['dataset_key','sheet_name','schema_signature','columns_json','row_count','status','created_at','updated_at','created_by'];
  const missing=required.filter(k=>index[k]===undefined);
  if(missing.length)throw new Error('DATASET_REGISTRY_SCHEMA_INVALID: '+missing.join(', '));
  return {sheet,values,header,index,rows:values.slice(1)};
}

function getCanonicalDatasetIdentity_(row,index,validateRowCount){
  const datasetKey=String(row[index.dataset_key]||'').trim();
  const sheetName=String(row[index.sheet_name]||'').trim();
  const signature=String(row[index.schema_signature]||'').trim();
  const status=String(row[index.status]||'').trim().toUpperCase();
  if(!datasetKey||!sheetName||!signature||!status)throw new Error('DATASET_IDENTITY_INCOMPLETE');
  let columns;
  try{columns=JSON.parse(String(row[index.columns_json]||''));}catch(e){throw new Error('DATASET_IDENTITY_COLUMNS_INVALID: '+datasetKey);}
  if(!Array.isArray(columns)||!columns.length)throw new Error('DATASET_IDENTITY_COLUMNS_INVALID: '+datasetKey);
  const canonicalSignature=schemaSignature_(columns);
  if(canonicalSignature!==signature)throw new Error('DATASET_IDENTITY_SIGNATURE_DRIFT: '+datasetKey);
  const expectedSheet=APP.SHEET_PREFIX+datasetKey;
  if(sheetName!==expectedSheet)throw new Error('DATASET_IDENTITY_SHEET_DRIFT: '+datasetKey);
  const contract=DATASET_CONTRACTS[datasetKey];
  if(contract){
    if(JSON.stringify(columns)!==JSON.stringify(contract.columns))throw new Error('DATASET_IDENTITY_CONTRACT_COLUMNS_DRIFT: '+datasetKey);
    if(signature!==schemaSignature_(contract.columns))throw new Error('DATASET_IDENTITY_CONTRACT_SIGNATURE_DRIFT: '+datasetKey);
  }
  const sheet=getDb_().getSheetByName(sheetName);
  if(!sheet)throw new Error('DATASET_SHEET_NOT_FOUND: '+sheetName);
  const actualHeader=sheet.getRange(1,1,1,columns.length).getValues()[0].map(String);
  if(JSON.stringify(actualHeader)!==JSON.stringify(columns))throw new Error('DATASET_IDENTITY_HEADER_DRIFT: '+datasetKey);
  const physicalRowCount=Math.max(sheet.getLastRow()-1,0);
  const registryRowCount=Number(row[index.row_count]||0);
  if(validateRowCount!==false&&registryRowCount!==physicalRowCount)throw new Error('DATASET_IDENTITY_ROW_COUNT_DRIFT: '+datasetKey);
  return {datasetKey,sheetName,signature,columns,rowCount:registryRowCount,status,contractKey:contract?datasetKey:null};
}

function verifyDatasetRegistryIntegrityV1(){
  const user=requirePermission_('audit.read');
  const snapshot=getDatasetRegistrySnapshot_(),issues=[],active=[];
  const byKey={},bySignature={},bySheet={};
  snapshot.rows.forEach((row,n)=>{
    const rowNumber=n+2;
    const status=String(row[snapshot.index.status]||'').trim().toUpperCase();
    if(status!=='ACTIVE')return;
    try{
      const identity=getCanonicalDatasetIdentity_(row,snapshot.index);
      active.push(identity);
      [ ['dataset_key',identity.datasetKey,byKey], ['schema_signature',identity.signature,bySignature], ['sheet_name',identity.sheetName,bySheet] ].forEach(([kind,key,map])=>{
        if(map[key]!==undefined)issues.push('DUPLICATE_ACTIVE_'+kind.toUpperCase()+': '+key+' rows '+map[key]+' and '+rowNumber+'.');
        else map[key]=rowNumber;
      });
    }catch(e){issues.push('ROW '+rowNumber+': '+String(e.message||e));}
  });
  const result={ok:issues.length===0,verifiedAt:nowIso_(),actor:user.email,registryRows:snapshot.rows.length,activeDatasets:active.length,issues,datasets:active};
  appendAudit_('DATASET_REGISTRY_INTEGRITY', 'SYSTEM', '', active.length, result.ok?'SUCCESS':'FAILED', JSON.stringify({issues:result.issues}));
  if(!result.ok)throw new Error('DATASET_REGISTRY_INTEGRITY_FAILED: '+issues.join(' | '));
  return result;
}
