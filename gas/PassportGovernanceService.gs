function getActiveDatasetContract_(datasetKey){
  const contract=DATASET_CONTRACTS[datasetKey];
  if(!contract)throw new Error('DATASET_CONTRACT_NOT_FOUND: '+datasetKey);
  const ss=getDb_(),registry=ss.getSheetByName(SHEETS.DATASET_REGISTRY);
  const values=registry.getDataRange().getValues(),header=values[0]||[];
  const i=Object.fromEntries(header.map((x,n)=>[x,n]));
  const row=values.slice(1).find(r=>String(r[i.dataset_key]||'')===datasetKey&&String(r[i.status]||'').toUpperCase()==='ACTIVE');
  if(!row)throw new Error('DATASET_NOT_REGISTERED: '+datasetKey);
  const sheetName=String(row[i.sheet_name]||APP.SHEET_PREFIX+datasetKey);
  const sheet=ss.getSheetByName(sheetName);
  if(!sheet)throw new Error('DATASET_SHEET_NOT_FOUND: '+sheetName);
  return {contract,registryRow:row,registryIndex:i,sheetName,sheet};
}

function verifyPassportServiceMonthly(){
  return verifyDatasetIntegrityV1('PASSPORT_SERVICE_MONTHLY');
}

function exportPassportServiceMonthly(filters){
  const user=requirePermission_('dataset.export');
  const d=getActiveDatasetContract_('PASSPORT_SERVICE_MONTHLY'),values=d.sheet.getDataRange().getValues();
  if(values.length<2)throw new Error('DATASET_EMPTY');
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const requestedPeriod=String((filters&&filters.periode)||'').trim(),requestedOffice=String((filters&&filters.kantor_imigrasi)||'').trim();
  const periodOf_=r=>normalizePeriodCell_(r[hi.periode]),officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const rows=values.slice(1).filter(r=>r.some(v=>String(v)!=='')).filter(r=>(!requestedPeriod||periodOf_(r)===requestedPeriod)&&(!requestedOffice||officeOf_(r)===requestedOffice));
  const csv=[header.map(csvEscape_).join(',')];
  rows.forEach(r=>csv.push(r.map((v,i)=>i===hi.periode?periodOf_(r):v).map(csvEscape_).join(',')));
  const filename='passport_service_monthly'+(requestedPeriod||requestedOffice?'_filtered':'_all')+'_'+Utilities.formatDate(new Date(),APP.TZ,'yyyyMMdd_HHmmss')+'.csv';
  appendAudit_('DATASET_EXPORT','PASSPORT_SERVICE_MONTHLY','',rows.length,'SUCCESS',JSON.stringify({format:'csv',periode:requestedPeriod,kantor_imigrasi:requestedOffice,filename,actor:user.email}));
  return {ok:true,filename,rowCount:rows.length,content:csv.join('\n')};
}

function verifyPassportServiceExportV1(filters){
  const user=requirePermission_('audit.read');
  requirePermission_('dataset.export');
  const datasetKey='PASSPORT_SERVICE_MONTHLY',d=getActiveDatasetContract_(datasetKey),values=d.sheet.getDataRange().getValues();
  if(values.length<2)throw new Error('DATASET_EMPTY');
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const requestedPeriod=String((filters&&filters.periode)||'').trim(),requestedOffice=String((filters&&filters.kantor_imigrasi)||'').trim();
  const periodOf_=r=>normalizePeriodCell_(r[hi.periode]),officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const expectedRows=values.slice(1).filter(r=>r.some(v=>String(v)!=='')).filter(r=>(!requestedPeriod||periodOf_(r)===requestedPeriod)&&(!requestedOffice||officeOf_(r)===requestedOffice));
  const exported=exportPassportServiceMonthly(filters),lines=String(exported.content||'').split('\n');
  const parseCsvLine_=line=>{const out=[],re=/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g;let m;while((m=re.exec(line))!==null){let value=m[1]||'';if(value.charAt(0)==='"'&&value.charAt(value.length-1)==='"')value=value.slice(1,-1).replace(/""/g,'"');out.push(value);if(m.index+m[0].length>=line.length)break;}return out;};
  const exportedHeader=parseCsvLine_(lines[0]||''),exportedRows=lines.slice(1).filter(line=>line!=='').map(parseCsvLine_),issues=[];
  if(JSON.stringify(exportedHeader)!==JSON.stringify(header))issues.push('CSV header berbeda dari dataset header.');
  if(exportedRows.length!==expectedRows.length)issues.push('CSV row count '+exportedRows.length+' berbeda dari expected '+expectedRows.length+'.');
  if(Number(exported.rowCount)!==expectedRows.length)issues.push('Export response rowCount berbeda dari expected.');
  let valueMismatches=0,totalExpected=0,totalExported=0;const businessKeys={};
  expectedRows.forEach((row,rowIndex)=>{
    const csvRow=exportedRows[rowIndex];if(!csvRow)return;
    header.forEach((column,index)=>{
      let expected=row[index];
      if(index===hi.periode)expected=periodOf_(row);
      const expectedText=String(expected===null||expected===undefined?'':expected);
      if(csvRow[index]!==expectedText)valueMismatches++;
    });
    const key=periodOf_(row)+'|'+officeOf_(row).toUpperCase();businessKeys[key]=(businessKeys[key]||0)+1;
    totalExpected+=Number(row[hi.total]||0);totalExported+=Number(csvRow[hi.total]||0);
  });
  const duplicateExportKeys=Object.values(businessKeys).filter(n=>n>1).length;
  if(valueMismatches!==0)issues.push('CSV value mismatches: '+valueMismatches+'.');
  if(duplicateExportKeys!==0)issues.push('CSV duplicate business keys: '+duplicateExportKeys+'.');
  if(totalExported!==totalExpected)issues.push('CSV aggregate total '+totalExported+' berbeda dari expected '+totalExpected+'.');
  const result={ok:issues.length===0,verifiedAt:nowIso_(),actor:user.email,datasetKey,filters:{periode:requestedPeriod,kantor_imigrasi:requestedOffice},expectedRows:expectedRows.length,exportedRows:exportedRows.length,expectedTotal:totalExpected,exportedTotal:totalExported,valueMismatches,duplicateExportKeys,filename:exported.filename,issues};
  Logger.log(JSON.stringify(result));return result;
}

function findLatestPassportServiceSnapshot_(){
  const cfg=backupConfig_();if(!cfg.folderId)return '';
  const folder=DriveApp.getFolderById(cfg.folderId),files=folder.getFiles();let latest=null;
  while(files.hasNext()){const file=files.next(),name=file.getName();if(name.indexOf('BACKUP_PASSPORT_SERVICE_MONTHLY_')!==0)continue;if(!latest||file.getLastUpdated().getTime()>latest.getLastUpdated().getTime())latest=file;}
  return latest?latest.getId():'';
}

function createPassportServiceSnapshot(){
  requirePermission_('admin.config');
  const cfg=backupConfig_();if(!cfg.folderId)throw new Error('BACKUP_FOLDER_NOT_CONFIGURED');
  const d=getActiveDatasetContract_('PASSPORT_SERVICE_MONTHLY'),source=getDb_(),values=d.sheet.getDataRange().getValues();
  const normalized=values.map(row=>row.map(v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"):v));
  const csv=normalized.map(r=>r.map(csvEscapeBackup_).join(',')).join('\n'),checksum=sha256Hex_(csv),rowCount=Math.max(0,values.length-1),snapshotId=Utilities.getUuid(),timestamp=nowIso_();
  const filename='BACKUP_PASSPORT_SERVICE_MONTHLY_'+Utilities.formatDate(new Date(),APP.TZ,'yyyyMMdd_HHmmss');
  const backup=SpreadsheetApp.create(filename),backupId=backup.getId(),dataSheet=backup.getSheets()[0];
  dataSheet.setName('PASSPORT_SERVICE_MONTHLY');
  dataSheet.getRange(1,1,values.length,values[0].length).setValues(normalized);dataSheet.setFrozenRows(1);
  const manifest=backup.insertSheet('SNAPSHOT_MANIFEST');manifest.getRange(1,1,1,2).setValues([['key','value']]);
  manifest.getRange(2,1,10,2).setValues([['snapshot_id',snapshotId],['created_at',timestamp],['dataset_key','PASSPORT_SERVICE_MONTHLY'],['schema_version',String(d.contract.version)],['schema_signature',String(d.registryRow[d.registryIndex.schema_signature]||'')],['source_spreadsheet_id',source.getId()],['source_sheet',d.sheetName],['row_count',rowCount],['content_sha256',checksum],['status','COMPLETE']]);manifest.setFrozenRows(1);
  const folder=DriveApp.getFolderById(cfg.folderId),file=DriveApp.getFileById(backupId);folder.addFile(file);try{DriveApp.getRootFolder().removeFile(file);}catch(e){}
  appendAudit_('BACKUP_SNAPSHOT_CREATE','PASSPORT_SERVICE_MONTHLY',snapshotId,rowCount,'SUCCESS',JSON.stringify({backupSpreadsheetId:backupId,filename,checksum,folderId:cfg.folderId}));
  return {ok:true,snapshotId,backupSpreadsheetId:backupId,filename,rowCount,checksum,folderId:cfg.folderId};
}

function verifyPassportServiceSnapshot(snapshotSpreadsheetId){
  const user=requirePermission_('audit.read'),cfg=backupConfig_();if(!cfg.folderId)throw new Error('BACKUP_FOLDER_NOT_CONFIGURED');
  const snapshotId=String(snapshotSpreadsheetId||'').trim();if(!snapshotId)throw new Error('SNAPSHOT_SPREADSHEET_ID_REQUIRED');
  const d=getActiveDatasetContract_('PASSPORT_SERVICE_MONTHLY'),source=getDb_(),sourceValues=d.sheet.getDataRange().getValues(),normalizedSource=sourceValues.map(row=>row.map(v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"):v));
  const sourceCsv=normalizedSource.map(r=>r.map(csvEscapeBackup_).join(',')).join('\n'),sourceChecksum=sha256Hex_(sourceCsv),sourceRowCount=Math.max(0,sourceValues.length-1);
  let snapshot;try{snapshot=SpreadsheetApp.openById(snapshotId);}catch(e){throw new Error('SNAPSHOT_NOT_FOUND: '+snapshotId);}
  const parents=DriveApp.getFileById(snapshotId).getParents();let inConfiguredFolder=false;while(parents.hasNext()){if(parents.next().getId()===cfg.folderId){inConfiguredFolder=true;break;}}
  const dataSheet=snapshot.getSheetByName('PASSPORT_SERVICE_MONTHLY'),manifest=snapshot.getSheetByName('SNAPSHOT_MANIFEST');if(!dataSheet)throw new Error('SNAPSHOT_DATASET_SHEET_NOT_FOUND');if(!manifest)throw new Error('SNAPSHOT_MANIFEST_NOT_FOUND');
  const mv=manifest.getDataRange().getValues(),mm={};mv.slice(1).forEach(r=>{if(String(r[0]||''))mm[String(r[0])]=String(r[1]??'');});
  const snapshotValues=dataSheet.getDataRange().getValues(),normalizedSnapshot=snapshotValues.map(row=>row.map(v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"):v)),snapshotCsv=normalizedSnapshot.map(r=>r.map(csvEscapeBackup_).join(',')).join('\n'),snapshotChecksum=sha256Hex_(snapshotCsv),snapshotRowCount=Math.max(0,snapshotValues.length-1),issues=[];
  if(mm.status!=='COMPLETE')issues.push('Snapshot manifest status bukan COMPLETE.');
  if(mm.dataset_key!=='PASSPORT_SERVICE_MONTHLY')issues.push('Manifest dataset_key berbeda.');
  if(mm.schema_version!==String(d.contract.version))issues.push('Manifest schema_version berbeda.');
  if(mm.source_spreadsheet_id!==source.getId())issues.push('Manifest source_spreadsheet_id berbeda.');
  if(mm.source_sheet!==d.sheetName)issues.push('Manifest source_sheet berbeda.');
  if(mm.schema_signature!==String(d.registryRow[d.registryIndex.schema_signature]||''))issues.push('Manifest schema_signature berbeda.');
  if(Number(mm.row_count)!==sourceRowCount)issues.push('Manifest row_count berbeda dari source.');
  if(mm.content_sha256!==sourceChecksum)issues.push('Manifest checksum berbeda dari source.');
  if(!inConfiguredFolder)issues.push('Snapshot berada di luar BACKUP_FOLDER_ID.');
  if(JSON.stringify(snapshotValues[0]||[])!==JSON.stringify(sourceValues[0]||[]))issues.push('Snapshot header berbeda dari source.');
  if(snapshotRowCount!==sourceRowCount)issues.push('Snapshot row count berbeda dari source.');
  if(snapshotChecksum!==sourceChecksum)issues.push('Snapshot content checksum berbeda dari source.');
  const result={ok:issues.length===0,verifiedAt:nowIso_(),actor:user.email,datasetKey:'PASSPORT_SERVICE_MONTHLY',snapshotSpreadsheetId:snapshotId,inConfiguredFolder,sourceRowCount,snapshotRowCount,sourceChecksum,snapshotChecksum,manifestChecksum:String(mm.content_sha256||''),issues};
  appendAudit_('BACKUP_SNAPSHOT_VERIFY','PASSPORT_SERVICE_MONTHLY',snapshotId,sourceRowCount,result.ok?'SUCCESS':'FAILED',JSON.stringify(result));
  return result;
}
