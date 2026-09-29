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