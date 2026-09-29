function backupConfig_(){
  const props=PropertiesService.getScriptProperties();
  return {folderId:String(props.getProperty('BACKUP_FOLDER_ID')||'').trim()};
}
function normalizeDriveFolderId_(value){
  const raw=String(value||'').trim();
  if(!raw)throw new Error('BACKUP_FOLDER_ID wajib diisi.');
  const match=raw.match(/\/folders\/([A-Za-z0-9_-]+)/);
  const id=match?match[1]:raw;
  if(!/^[A-Za-z0-9_-]{10,}$/.test(id))throw new Error('BACKUP_FOLDER_ID tidak valid. Masukkan Folder ID atau URL folder Google Drive.');
  return id;
}
function setBackupFolder(folderId){
  requirePermission_('admin.config');
  const id=normalizeDriveFolderId_(folderId);
  const folder=DriveApp.getFolderById(id);
  if(!folder)throw new Error('BACKUP_FOLDER_NOT_FOUND');
  PropertiesService.getScriptProperties().setProperty('BACKUP_FOLDER_ID',id);
  return {ok:true,folderId:id,name:folder.getName()};
}
function getBackupConfig(){
  requirePermission_('admin.config');
  const cfg=backupConfig_();
  return {configured:Boolean(cfg.folderId),folderId:cfg.folderId};
}
function csvEscapeBackup_(value){
  const s=String(value===null||value===undefined?'':value);
  return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function sha256Hex_(text){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8);
  return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function createResidencePermitSnapshot(){
  requirePermission_('admin.config');
  const cfg=backupConfig_();
  if(!cfg.folderId)throw new Error('BACKUP_FOLDER_NOT_CONFIGURED');
  const source=getDb_(),datasetKey='RESIDENCE_PERMIT_SERVICE_MONTHLY';
  const registry=source.getSheetByName(SHEETS.DATASET_REGISTRY);
  const rv=registry.getDataRange().getValues(),rh=rv[0]||[],ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
  const reg=rv.slice(1).find(r=>String(r[ri.dataset_key]||'')===datasetKey&&String(r[ri.status]||'').toUpperCase()==='ACTIVE');
  if(!reg)throw new Error('DATASET_NOT_REGISTERED');
  const sheetName=String(reg[ri.sheet_name]||APP.SHEET_PREFIX+datasetKey),sourceSheet=source.getSheetByName(sheetName);
  if(!sourceSheet)throw new Error('DATASET_SHEET_NOT_FOUND: '+sheetName);
  const values=sourceSheet.getDataRange().getValues();
  const normalized=values.map(row=>row.map(v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"):v));
  const csv=normalized.map(r=>r.map(csvEscapeBackup_).join(',')).join('\n');
  const checksum=sha256Hex_(csv),rowCount=Math.max(0,values.length-1),snapshotId=Utilities.getUuid(),timestamp=nowIso_();
  const filename='BACKUP_'+datasetKey+'_'+Utilities.formatDate(new Date(),APP.TZ,'yyyyMMdd_HHmmss');
  const backup=SpreadsheetApp.create(filename),backupId=backup.getId(),dataSheet=backup.getSheets()[0];
  dataSheet.setName(datasetKey);
  if(values.length&&values[0].length){dataSheet.getRange(1,1,values.length,values[0].length).setValues(normalized);dataSheet.setFrozenRows(1);}
  const manifest=backup.insertSheet('SNAPSHOT_MANIFEST');
  manifest.getRange(1,1,1,2).setValues([['key','value']]);
  manifest.getRange(2,1,10,2).setValues([
    ['snapshot_id',snapshotId],['created_at',timestamp],['dataset_key',datasetKey],['schema_version','1'],
    ['schema_signature',String(reg[ri.schema_signature]||'')],['source_spreadsheet_id',source.getId()],
    ['source_sheet',sheetName],['row_count',rowCount],['content_sha256',checksum],['status','COMPLETE']
  ]);
  manifest.setFrozenRows(1);
  const folder=DriveApp.getFolderById(cfg.folderId),file=DriveApp.getFileById(backupId);
  folder.addFile(file);
  try{DriveApp.getRootFolder().removeFile(file);}catch(e){}
  appendAudit_('BACKUP_SNAPSHOT_CREATE',datasetKey,snapshotId,rowCount,'SUCCESS',JSON.stringify({backupSpreadsheetId:backupId,filename,checksum,folderId:cfg.folderId}));
  return {ok:true,snapshotId,backupSpreadsheetId:backupId,filename,rowCount,checksum,folderId:cfg.folderId};
}

function verifyResidencePermitSnapshot(snapshotSpreadsheetId){
  const user=requirePermission_('audit.read');
  const cfg=backupConfig_();
  if(!cfg.folderId)throw new Error('BACKUP_FOLDER_NOT_CONFIGURED');
  const snapshotId=String(snapshotSpreadsheetId||'').trim();
  if(!snapshotId)throw new Error('SNAPSHOT_SPREADSHEET_ID_REQUIRED');

  const source=getDb_(),datasetKey='RESIDENCE_PERMIT_SERVICE_MONTHLY';
  const registry=source.getSheetByName(SHEETS.DATASET_REGISTRY);
  const rv=registry.getDataRange().getValues(),rh=rv[0]||[],ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
  const reg=rv.slice(1).find(r=>String(r[ri.dataset_key]||'')===datasetKey&&String(r[ri.status]||'').toUpperCase()==='ACTIVE');
  if(!reg)throw new Error('DATASET_NOT_REGISTERED');
  const sheetName=String(reg[ri.sheet_name]||APP.SHEET_PREFIX+datasetKey);
  const sourceSheet=source.getSheetByName(sheetName);
  if(!sourceSheet)throw new Error('DATASET_SHEET_NOT_FOUND: '+sheetName);

  const sourceValues=sourceSheet.getDataRange().getValues();
  const normalizedSource=sourceValues.map(row=>row.map(v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"):v));
  const sourceCsv=normalizedSource.map(r=>r.map(csvEscapeBackup_).join(',')).join('\n');
  const sourceChecksum=sha256Hex_(sourceCsv);
  const sourceRowCount=Math.max(0,sourceValues.length-1);
  const sourceHeader=normalizedSource[0]||[];

  let snapshot;
  try{snapshot=SpreadsheetApp.openById(snapshotId);}catch(e){throw new Error('SNAPSHOT_NOT_FOUND: '+snapshotId);}
  const folder=DriveApp.getFolderById(cfg.folderId);
  let inConfiguredFolder=false;
  const parents=DriveApp.getFileById(snapshotId).getParents();
  while(parents.hasNext()){if(parents.next().getId()===cfg.folderId){inConfiguredFolder=true;break;}}
  const dataSheet=snapshot.getSheetByName(datasetKey);
  const manifest=snapshot.getSheetByName('SNAPSHOT_MANIFEST');
  if(!dataSheet)throw new Error('SNAPSHOT_DATASET_SHEET_NOT_FOUND');
  if(!manifest)throw new Error('SNAPSHOT_MANIFEST_NOT_FOUND');

  const manifestValues=manifest.getDataRange().getValues();
  const manifestMap={};
  manifestValues.slice(1).forEach(r=>{if(String(r[0]||''))manifestMap[String(r[0])]=String(r[1]??'');});
  const snapshotValues=dataSheet.getDataRange().getValues();
  const normalizedSnapshot=snapshotValues.map(row=>row.map(v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"):v));
  const snapshotCsv=normalizedSnapshot.map(r=>r.map(csvEscapeBackup_).join(',')).join('\n');
  const snapshotChecksum=sha256Hex_(snapshotCsv);
  const snapshotRowCount=Math.max(0,snapshotValues.length-1);
  const issues=[];
  if(manifestMap.status!=='COMPLETE')issues.push('Snapshot manifest status bukan COMPLETE.');
  if(manifestMap.dataset_key!==datasetKey)issues.push('Manifest dataset_key berbeda.');
  if(manifestMap.schema_version!=='1')issues.push('Manifest schema_version bukan 1.');
  if(manifestMap.source_spreadsheet_id!==source.getId())issues.push('Manifest source_spreadsheet_id berbeda.');
  if(manifestMap.source_sheet!==sheetName)issues.push('Manifest source_sheet berbeda.');
  if(manifestMap.schema_signature!==String(reg[ri.schema_signature]||''))issues.push('Manifest schema_signature berbeda.');
  if(Number(manifestMap.row_count)!==sourceRowCount)issues.push('Manifest row_count berbeda dari source.');
  if(manifestMap.content_sha256!==sourceChecksum)issues.push('Manifest checksum berbeda dari source.');
  if(!inConfiguredFolder)issues.push('Snapshot berada di luar BACKUP_FOLDER_ID.');
  if(JSON.stringify(snapshotValues[0]||[])!==JSON.stringify(sourceValues[0]||[]))issues.push('Snapshot header berbeda dari source.');
  if(snapshotRowCount!==sourceRowCount)issues.push('Snapshot row count berbeda dari source.');
  if(snapshotChecksum!==sourceChecksum)issues.push('Snapshot content checksum berbeda dari source.');
  if(snapshotValues.length!==normalizedSource.length)issues.push('Snapshot physical row count berbeda dari source.');
  const width=Math.max(sourceHeader.length,normalizedSnapshot[0]?normalizedSnapshot[0].length:0);
  if(width!==sourceHeader.length)issues.push('Snapshot column count berbeda dari source.');
  if(issues.length===0){
    for(let r=0;r<normalizedSource.length;r++){
      const a=normalizedSource[r]||[],z=normalizedSnapshot[r]||[];
      for(let c=0;c<sourceHeader.length;c++){
        if(String(a[c]??'')!==String(z[c]??'')){issues.push('Snapshot cell mismatch pada row '+(r+1)+', column '+(c+1)+'.');r=normalizedSource.length;break;}
      }
    }
  }
  const result={
    ok:issues.length===0,
    verifiedAt:nowIso_(),
    actor:user.email,
    datasetKey,
    snapshotSpreadsheetId:snapshotId,
    snapshotName:snapshot.getName(),
    sourceSheet:sheetName,
    inConfiguredFolder,
    sourceRowCount,
    snapshotRowCount,
    manifestRowCount:Number(manifestMap.row_count||0),
    sourceChecksum,
    snapshotChecksum,
    manifestChecksum:String(manifestMap.content_sha256||''),
    schemaSignature:String(reg[ri.schema_signature]||''),
    manifestSchemaSignature:String(manifestMap.schema_signature||''),
    issues
  };
  appendAudit_('BACKUP_SNAPSHOT_VERIFY',datasetKey,snapshotId,sourceRowCount,result.ok?'SUCCESS':'FAILED',JSON.stringify({
    snapshotSpreadsheetId:snapshotId,
    inConfiguredFolder,
    sourceRowCount,
    snapshotRowCount,
    sourceChecksum,
    snapshotChecksum,
    issues
  }));
  Logger.log(JSON.stringify(result));
  return result;
}
