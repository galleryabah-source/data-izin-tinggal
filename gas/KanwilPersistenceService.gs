/**
 * Kanwil application persistence v1.
 * All writes target the dedicated KANWIL staging spreadsheet only.
 * No connection to monthly datasets, importer, registry, or Daily Input.
 */
const KANWIL_APPLICATION_FIELDS_V1 = Object.freeze([
  'tanggal_pembayaran','tanggal_mulai_verifikasi','tanggal_auto_terbit','layanan',
  'kategori_produk','nomor_permohonan','tanggal_permohonan','penjamin','nama',
  'jenis_kelamin','tanggal_lahir','kebangsaan','no_passport','jenis_produk',
  'tujuan','posisi_permohonan','status_permohonan'
]);
function kanwilEntryEnabled_(){
  return PropertiesService.getScriptProperties().getProperty('KANWIL_STAGING_ENABLED')==='true';
}
function kanwilRequireReady_(){
  if(!kanwilEntryEnabled_())throw new Error('KANWIL_ENTRY_DISABLED');
  const readiness=kanwilStagingReadinessV1_();
  if(!readiness.ready)throw new Error('KANWIL_STAGING_NOT_READY: '+readiness.reason);
  return SpreadsheetApp.openById(kanwilStagingSpreadsheetId_());
}
function kanwilSheets_(ss){
  const out={};
  Object.keys(KANWIL_STAGING_SHEETS_V1).forEach(key=>out[key]=ss.getSheetByName('KANWIL_'+key.toUpperCase()));
  return out;
}
function kanwilHeader_(sh){return Object.fromEntries(sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map((x,i)=>[String(x),i]));}
function kanwilPayloadV1_(input){
  const x=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const values=x.values&&typeof x.values==='object'&&!Array.isArray(x.values)?x.values:x;
  const normalized={};
  KANWIL_APPLICATION_FIELDS_V1.forEach(key=>{
    const raw=values[key];
    const value=raw===undefined||raw===null?'':String(raw).trim();
    if(value.length>500)throw new Error('KANWIL_FIELD_TOO_LONG: '+key);
    normalized[key]=value||null;
  });
  if(!normalized.nomor_permohonan)throw new Error('KANWIL_APPLICATION_NUMBER_REQUIRED');
  if(!normalized.nama)throw new Error('KANWIL_APPLICANT_NAME_REQUIRED');
  if(normalized.jenis_kelamin&&!['MALE','FEMALE'].includes(String(normalized.jenis_kelamin).toUpperCase()))
    throw new Error('KANWIL_GENDER_INVALID');
  normalized.jenis_kelamin=normalized.jenis_kelamin?String(normalized.jenis_kelamin).toUpperCase():null;
  ['tanggal_lahir'].forEach(key=>{
    if(normalized[key]){const value=normalized[key],date=new Date(value+'T00:00:00Z');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('KANWIL_DATE_INVALID: '+key);}
  });
  ['tanggal_pembayaran','tanggal_mulai_verifikasi','tanggal_auto_terbit','tanggal_permohonan'].forEach(key=>{
    if(normalized[key]){const value=normalized[key],iso=value.replace(' ','T'),date=new Date(iso+'Z');
      if(!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value.slice(0,10))
        throw new Error('KANWIL_DATETIME_INVALID: '+key);}
  });
  return normalized;
}
function kanwilSafeCellTextV1_(value){const text=String(value??'');return /^[=+@-]/.test(text)?"'"+text:text;}
function kanwilHashV1_(value){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value),Utilities.Charset.UTF_8);
  return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');
}
function kanwilBuildExistingIdempotencyIndexV1_(rows,keyIndex,hashIndex){
  const index=new Map();
  (rows||[]).forEach(row=>{
    const key=String(row[keyIndex]||'');
    if(!key)return;
    if(index.has(key))throw new Error('KANWIL_STAGING_IDEMPOTENCY_KEY_DUPLICATE');
    index.set(key,String(row[hashIndex]||''));
  });
  return index;
}
function kanwilCheckpointV1_(sheets,names){const out={};names.forEach(name=>out[name]=sheets[name].getLastRow());return out;}
function kanwilRollbackV1_(sheets,checkpoint){
  Object.keys(checkpoint).reverse().forEach(name=>{
    const extra=sheets[name].getLastRow()-checkpoint[name];
    if(extra>0)sheets[name].deleteRows(checkpoint[name]+1,extra);
  });
}
function kanwilAppendEventV1_(sheets,recordId,stagingId,eventType,fromState,toState,revision,hash,actor,reason,correlationId){
  const rows=sheets.events.getDataRange().getValues(),header=kanwilHeader_(sheets.events);
  const sequence=rows.slice(1).filter(r=>(stagingId&&String(r[header.staging_id])===stagingId)||(recordId&&String(r[header.record_id])===recordId)).reduce((max,r)=>Math.max(max,Number(r[header.event_sequence])||0),0)+1;
  sheets.events.appendRow([Utilities.getUuid(),recordId||'',stagingId||'',sequence,eventType,fromState||'',toState,
    revision,hash,actor,kanwilSafeCellTextV1_(reason||''),correlationId,nowIso_()]);
}
function kanwilResolveBatchScopeV1_(batchRows,batchHeader,batchId,configuredScope){
  const matches=batchRows.slice(1).filter(row=>String(row[batchHeader.batch_id]||'')===String(batchId));
  if(matches.length!==1)throw new Error(matches.length?'KANWIL_BATCH_ID_NOT_UNIQUE':'KANWIL_BATCH_NOT_FOUND');
  const persistedScope=String(matches[0][batchHeader.kanwil_scope_id]||'').trim();
  if(!persistedScope||persistedScope!==String(configuredScope||'').trim())throw new Error('KANWIL_BATCH_SCOPE_MISMATCH');
  return persistedScope;
}
function kanwilAppendAuditV1_(sheets,batchId,recordId,stagingId,actor,action,reason,correlationId,fileId){
  sheets.audit.appendRow([Utilities.getUuid(),batchId||'',fileId||'',recordId||'',stagingId||'',actor,action,kanwilSafeCellTextV1_(reason||''),correlationId,nowIso_()]);
}
function getKanwilEntryStatus(){
  requireBackOfficeAccess_();
  const readiness=kanwilStagingReadinessV1_();
  const folderId=String(PropertiesService.getScriptProperties().getProperty('KANWIL_DRIVE_FOLDER_ID')||'').trim();
  let driveReady=false;
  if(folderId){try{const folder=DriveApp.getFolderById(folderId);driveReady=!!folder&&String(folder.getId())===folderId;}catch(error){}}
  const enabled=kanwilEntryEnabled_()&&readiness.ready&&driveReady;
  const reason=!readiness.ready?readiness.reason:(!driveReady?'DRIVE_FOLDER_NOT_READY':(kanwilEntryEnabled_()?'READY':'FEATURE_FLAG_OFF'));
  return {enabled,configured:readiness.ready,driveConfigured:driveReady,reason,
    writeMode:'ISOLATED_KANWIL_STAGING',canonicalWrites:false};
}
function saveKanwilApplication(payload){
  const user=requireBackOfficeAccess_(),ss=kanwilRequireReady_(),p=kanwilPayloadV1_(payload);
  const submissionId=String(payload&&payload.submissionId||'').trim();
  if(!/^[A-Za-z0-9_-]{16,80}$/.test(submissionId))throw new Error('KANWIL_SUBMISSION_ID_INVALID');
  const reason=kanwilSafeCellTextV1_(String(payload&&payload.sourceReason||'MANUAL_ENTRY').trim().slice(0,250));
  const scope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
  if(!scope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
  const hash=kanwilHashV1_(p),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),values=sheets.staging.getDataRange().getValues(),h=kanwilHeader_(sheets.staging);
    const existing=values.slice(1).find(r=>String(r[h.idempotency_key]||'')===submissionId);
    if(existing){
      if(String(existing[h.payload_sha256]||'')!==hash)throw new Error('KANWIL_IDEMPOTENCY_CONFLICT');
      const persistedBatches=sheets.batches.getDataRange().getValues(),persistedBatchHeader=kanwilHeader_(sheets.batches);
      kanwilResolveBatchScopeV1_(persistedBatches,persistedBatchHeader,String(existing[h.batch_id]),scope);
      return {ok:true,stagingId:String(existing[h.staging_id]),state:String(existing[h.state]),idempotent:true};
    }
    const batchId=Utilities.getUuid(),fileId='',stagingId=Utilities.getUuid(),correlationId=Utilities.getUuid(),now=nowIso_();
    const batchHeaders=kanwilHeader_(sheets.batches);
    const batchRow=KANWIL_STAGING_SHEETS_V1.batches.map(k=>({
      batch_id:batchId,kanwil_scope_id:scope,source_channel:'MANUAL',contract_version:'KANWIL_PERMIT_APPLICATION_V1',
      parser_version:'manual-v1',created_by:user.email,created_at:now,state:'REVIEW_REQUIRED',
      file_count:0,record_count:1,correlation_id:correlationId
    }[k]??''));
    const stagingRow=KANWIL_STAGING_SHEETS_V1.staging.map(k=>({
      staging_id:stagingId,batch_id:batchId,file_id:fileId,source_row_number:1,idempotency_key:submissionId,
      contract_version:'KANWIL_PERMIT_APPLICATION_V1',raw_values_json:JSON.stringify(p),normalized_values_json:JSON.stringify(p),field_evidence_json:'{}',
      validation_errors_json:'[]',validation_warnings_json:'[]',review_state:'PENDING',state:'REVIEW_REQUIRED',revision:1,
      payload_sha256:hash,created_by:user.email,created_at:now,updated_at:now
    }[k]??''));
    const duplicate=values.slice(1).some(r=>{let saved={};try{saved=JSON.parse(String(r[h.normalized_values_json]||'{}'));}catch(e){}return String(saved.nomor_permohonan||'')===p.nomor_permohonan&&String(r[h.state]||'')!=='REJECTED';});
    if(duplicate)throw new Error('KANWIL_DUPLICATE_APPLICATION_NUMBER');
    const checkpoint=kanwilCheckpointV1_(sheets,['batches','staging','events','audit']);
    try{
      sheets.batches.appendRow(batchRow);
      sheets.staging.appendRow(stagingRow);
      kanwilAppendEventV1_(sheets,'',stagingId,'INTAKE_CREATED','', 'REVIEW_REQUIRED',1,hash,user.email,reason,correlationId);
      kanwilAppendAuditV1_(sheets,batchId,'',stagingId,user.email,'INTAKE_CREATED',reason,correlationId);
    }catch(error){
      try{kanwilRollbackV1_(sheets,checkpoint);}catch(rollbackError){}
      throw new Error('KANWIL_STAGING_WRITE_FAILED: '+String(error&&error.message||error));
    }
    return {ok:true,batchId,stagingId,state:'REVIEW_REQUIRED',idempotent:false};
  }finally{lock.releaseLock();}
}
function saveKanwilImportBatch(payload){
  const user=requireBackOfficeAccess_(),ss=kanwilRequireReady_(),x=payload&&typeof payload==='object'?payload:{};
  const source=x.sourceFile&&typeof x.sourceFile==='object'?x.sourceFile:{},channel=String(x.sourceChannel||'').toUpperCase();
  if(!['CSV','EXCEL','SCREENSHOT','CAMERA_PHOTO'].includes(channel))throw new Error('KANWIL_SOURCE_CHANNEL_INVALID');
  const fileName=kanwilSafeCellTextV1_(String(source.name||'').replace(/[\\/\\\\]/g,'_').slice(0,255));
  const clientSha=String(source.sha256||'').toLowerCase(),size=Number(source.size||0),mime=kanwilSafeCellTextV1_(String(source.mime||'application/octet-stream').slice(0,120));
  if(!fileName||! /^[a-f0-9]{64}$/.test(clientSha))throw new Error('KANWIL_SOURCE_FILE_METADATA_INVALID');
  // Base64 crosses google.script.run as text; cap raw bytes to keep RPC payload bounded.
  if(!Number.isSafeInteger(size)||size<1||size>10*1024*1024)throw new Error('KANWIL_SOURCE_FILE_SIZE_INVALID');
  const base64=String(source.base64Data||'');
  if(!base64||base64.length>14*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw new Error('KANWIL_SOURCE_FILE_BYTES_REQUIRED');
  const bytes=Utilities.base64Decode(base64);
  if(bytes.length!==size)throw new Error('KANWIL_SOURCE_FILE_SIZE_MISMATCH');
  const shaBytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes);
  const sha=shaBytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');
  if(sha!==clientSha)throw new Error('KANWIL_SOURCE_FILE_HASH_MISMATCH');
  const folderId=String(PropertiesService.getScriptProperties().getProperty('KANWIL_DRIVE_FOLDER_ID')||'').trim();
  if(!folderId)throw new Error('KANWIL_DRIVE_FOLDER_NOT_CONFIGURED');
  const folder=DriveApp.getFolderById(folderId);
  if(!folder||folder.getId()!==folderId)throw new Error('KANWIL_DRIVE_FOLDER_IDENTITY_MISMATCH');
  const records=Array.isArray(x.records)?x.records:[];
  if(!records.length||records.length>500)throw new Error('KANWIL_IMPORT_ROW_LIMIT');
  const sourceEvidence=x.sourceEvidence&&typeof x.sourceEvidence==='object'?x.sourceEvidence:{};
  const tabularSource=channel==='CSV'||channel==='EXCEL';
  const evidenceVersion='KANWIL_SOURCE_ROW_EVIDENCE_V1';
  if(tabularSource){
    if(sourceEvidence.version!==evidenceVersion)throw new Error('KANWIL_SOURCE_EVIDENCE_REQUIRED');
    if(!Number.isSafeInteger(sourceEvidence.sourceDataRowCount)||sourceEvidence.sourceDataRowCount<0||
       !Number.isSafeInteger(sourceEvidence.parsedRecordCount)||sourceEvidence.parsedRecordCount!==records.length||
       sourceEvidence.sourceDataRowCount!==records.length)
      throw new Error('KANWIL_SOURCE_ROW_COUNT_INVALID');
    if(!Array.isArray(sourceEvidence.sourceRowNumbers)||sourceEvidence.sourceRowNumbers.length!==records.length)
      throw new Error('KANWIL_SOURCE_ROW_MANIFEST_INVALID');
    records.forEach((record,index)=>{
      const row=record&&typeof record==='object'?record:{};
      if(Number(sourceEvidence.sourceRowNumbers[index])!==Number(row.sourceRowNumber))
        throw new Error('KANWIL_SOURCE_ROW_MANIFEST_MISMATCH');
    });
  }
  const scope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
  if(!scope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
  const contractVersion='KANWIL_PERMIT_APPLICATION_V1',parserVersion=kanwilSafeCellTextV1_(String(x.parserVersion||'browser-parser-v1').slice(0,80));
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),files=sheets.files.getDataRange().getValues(),fh=kanwilHeader_(sheets.files);
    const batchRows=sheets.batches.getDataRange().getValues(),batchHeader=kanwilHeader_(sheets.batches);
    const priorFileMatches=files.slice(1).filter(r=>
      String(r[fh.source_file_sha256]||'').toLowerCase()===sha&&
      String(r[fh.parser_version]||'')===parserVersion
    );
    if(priorFileMatches.length>1)throw new Error('KANWIL_FILE_IDENTITY_NOT_UNIQUE');
    if(priorFileMatches.length===1){
      const previous=priorFileMatches[0],parentMatches=batchRows.slice(1).filter(b=>
        String(b[batchHeader.batch_id]||'')===String(previous[fh.batch_id]||'')
      );
      if(parentMatches.length!==1)throw new Error('KANWIL_FILE_PARENT_BATCH_INVALID');
      const parent=parentMatches[0];
      if(String(parent[batchHeader.kanwil_scope_id]||'').trim()!==scope||
         String(parent[batchHeader.source_channel]||'').toUpperCase()!==channel)
        throw new Error('KANWIL_FILE_IDENTITY_SCOPE_OR_CHANNEL_CONFLICT');
      if(!String(previous[fh.file_id]||'').trim())throw new Error('KANWIL_FILE_IDENTITY_INVALID');
      return {ok:true,batchId:String(previous[fh.batch_id]),fileId:String(previous[fh.file_id]),idempotent:true};
    }
    const stagingValues=sheets.staging.getDataRange().getValues(),sh=kanwilHeader_(sheets.staging);
    const existingKeys=kanwilBuildExistingIdempotencyIndexV1_(stagingValues.slice(1),sh.idempotency_key,sh.payload_sha256);
    const batchId=Utilities.getUuid(),fileId=Utilities.getUuid(),correlationId=Utilities.getUuid(),now=nowIso_();
    const stageRows=[],eventRows=[],seenApplications=new Set(),seenSourceRows=new Set();
    let validCount=0,invalidCount=0;
    records.forEach((record,index)=>{
      const row=record&&typeof record==='object'?record:{},sourceRowRaw=row.sourceRowNumber===undefined||row.sourceRowNumber===null||row.sourceRowNumber===''?index+1:row.sourceRowNumber,sourceRow=Number(sourceRowRaw);
      if(!Number.isInteger(sourceRow)||sourceRow<1)throw new Error('KANWIL_SOURCE_ROW_NUMBER_INVALID');
      if(seenSourceRows.has(sourceRow))throw new Error('KANWIL_DUPLICATE_SOURCE_ROW_NUMBER');
      seenSourceRows.add(sourceRow);
      const raw=kanwilLoosePayloadV1_(row.rawValues||row.values||row.normalizedValues||{});
      let normalized=kanwilLoosePayloadV1_(row.normalizedValues||row.values||row.rawValues||{});
      const fieldEvidence=row.fieldEvidence&&typeof row.fieldEvidence==='object'&&!Array.isArray(row.fieldEvidence)?row.fieldEvidence:{};
      if(channel==='SCREENSHOT'){
        const missingEvidence=KANWIL_APPLICATION_FIELDS_V1.filter(key=>!fieldEvidence[key]||
          !fieldEvidence[key].columnBounds||!Number.isFinite(Number(fieldEvidence[key].columnBounds.left))||
          !Number.isFinite(Number(fieldEvidence[key].columnBounds.right))||
          !Array.isArray(fieldEvidence[key].reviewFlags));
        if(missingEvidence.length)throw new Error('KANWIL_SCREENSHOT_CELL_EVIDENCE_REQUIRED: '+missingEvidence.join(','));
      }
      const descriptor=buildKanwilIdempotencyDescriptorV1({kanwilScopeId:scope,sourceFileSha256:sha,
        contractVersion,parserVersion,sourceRowNumber:sourceRow});
      if(!descriptor.ok)throw new Error(descriptor.reason);
      const key=descriptor.key;
      let errors=Array.isArray(row.validationErrors)?row.validationErrors.map(item=>typeof item==='string'?item:String(item&&item.code||'OCR_VALIDATION_REVIEW')).slice(0,50):[];
      try{normalized=kanwilPayloadV1_({values:normalized});}
      catch(error){errors.push(String(error&&error.message||error));}
      // Hash the exact server-normalized payload that is persisted below.
      const hash=kanwilHashV1_(normalized);
      if(existingKeys.has(key)){
        if(existingKeys.get(key)!==hash)throw new Error('KANWIL_IMPORT_IDEMPOTENCY_CONFLICT');
        return;
      }
      const appNo=String(normalized.nomor_permohonan||'').trim();
      if(appNo&&seenApplications.has(appNo))errors.push('DUPLICATE_APPLICATION_NUMBER_IN_BATCH');
      if(appNo)seenApplications.add(appNo);
      if(appNo&&stagingValues.slice(1).some(r=>{
        let saved={};try{saved=JSON.parse(String(r[sh.normalized_values_json]||'{}'));}catch(e){}
        return String(saved.nomor_permohonan||'')===appNo&&String(r[sh.state]||'')!=='REJECTED';
      }))errors.push('DUPLICATE_APPLICATION_NUMBER_EXISTING');
      const warnings=[...(Array.isArray(row.warnings)?row.warnings:[]),...(Array.isArray(row.validationWarnings)?row.validationWarnings:[])].slice(0,100);
      const state=errors.length?'VALIDATION_REQUIRED':'REVIEW_REQUIRED';
      if(errors.length)invalidCount++;else validCount++;
      const stagingId=Utilities.getUuid();
      const valuesByKey={
        staging_id:stagingId,batch_id:batchId,file_id:fileId,source_row_number:sourceRow,idempotency_key:key,
        contract_version:contractVersion,raw_values_json:JSON.stringify(raw),normalized_values_json:JSON.stringify(normalized),
        validation_errors_json:JSON.stringify(errors),validation_warnings_json:JSON.stringify(warnings),field_evidence_json:JSON.stringify({cells:fieldEvidence,rowGeometry:row.rowGeometry||null}),
        review_state:'PENDING',state,payload_sha256:hash,revision:1,created_by:user.email,created_at:now,updated_at:now
      };
      stageRows.push(KANWIL_STAGING_SHEETS_V1.staging.map(k=>valuesByKey[k]??''));
      eventRows.push([Utilities.getUuid(),' ',stagingId,1,'FILE_IMPORT_ROW','',state,1,hash,user.email,
        errors.join('; ').slice(0,500),correlationId,now]);
    });
    if(!stageRows.length)return {ok:true,batchId:null,fileId:null,inserted:0,idempotent:true};
    const batchValues={
      batch_id:batchId,kanwil_scope_id:scope,source_channel:channel,contract_version:contractVersion,
      parser_version:parserVersion,source_exported_at:kanwilSafeCellTextV1_(String(x.sourceExportedAt||'')),source_authorization_ref:'',
      created_by:user.email,created_at:now,state:invalidCount?'VALIDATION_REQUIRED':'REVIEW_REQUIRED',
      file_count:1,record_count:stageRows.length,correlation_id:correlationId
    };
    const batchRow=KANWIL_STAGING_SHEETS_V1.batches.map(k=>batchValues[k]??'');
    const sourceRowNumbers=records.map((record,index)=>Number(record&&record.sourceRowNumber!==undefined?record.sourceRowNumber:index+1));
    const sourceDataRowCount=tabularSource?Number(sourceEvidence.sourceDataRowCount):null;
    const sourceEvidenceStatus=tabularSource?'CLIENT_ATTESTED':'UNAVAILABLE';
    const sourceRowManifestSha256=kanwilHashV1_({fileSha256:sha,parserVersion,sourceDataRowCount,
      parsedRecordCount:records.length,sourceRowNumbers});
    const fileValues={file_id:fileId,batch_id:batchId,source_filename:fileName,source_file_sha256:sha,
      source_file_mime:mime,source_file_size:size,source_row_count:records.length,
      source_data_row_count:sourceDataRowCount===null?'':sourceDataRowCount,parsed_record_count:records.length,
      source_row_manifest_sha256:sourceRowManifestSha256,source_evidence_status:sourceEvidenceStatus,
      parser_version:parserVersion,processing_state:'PARSED',drive_file_id:'',drive_file_url:'',storage_status:'PENDING',
      server_verified_sha256:sha,created_by:user.email,created_at:now};
    const fileRow=KANWIL_STAGING_SHEETS_V1.files.map(k=>fileValues[k]??'');
    const checkpoint=kanwilCheckpointV1_(sheets,['batches','files','staging','events','audit']);
    let driveFile=null;
    try{
      const blob=Utilities.newBlob(bytes,mime,fileName);
      driveFile=folder.createFile(blob);
      if(!driveFile||!driveFile.getId())throw new Error('KANWIL_DRIVE_FILE_CREATE_FAILED');
      fileValues.drive_file_id=driveFile.getId();
      fileValues.drive_file_url=driveFile.getUrl();
      fileValues.storage_status='STORED';
      const persistedFileRow=KANWIL_STAGING_SHEETS_V1.files.map(k=>fileValues[k]??'');
      sheets.batches.appendRow(batchRow);sheets.files.appendRow(persistedFileRow);
      sheets.staging.getRange(sheets.staging.getLastRow()+1,1,stageRows.length,stageRows[0].length).setValues(stageRows);
      sheets.events.getRange(sheets.events.getLastRow()+1,1,eventRows.length,eventRows[0].length).setValues(eventRows);
      kanwilAppendAuditV1_(sheets,batchId,'','',user.email,'FILE_IMPORT','Imported '+stageRows.length+' rows; '+invalidCount+' require validation',correlationId,fileId);
    }catch(error){
      try{kanwilRollbackV1_(sheets,checkpoint);}catch(rollbackError){}
      if(driveFile){try{driveFile.setTrashed(true);}catch(cleanupError){}}
      throw new Error('KANWIL_IMPORT_WRITE_FAILED: '+String(error&&error.message||error));
    }
    return {ok:true,batchId,fileId,driveFileId:driveFile.getId(),driveFileUrl:driveFile.getUrl(),storageStatus:'STORED',serverVerifiedSha256:sha,inserted:stageRows.length,validCount,invalidCount,state:invalidCount?'VALIDATION_REQUIRED':'REVIEW_REQUIRED',sourceEvidenceStatus,sourceDataRowCount:sourceDataRowCount===null?null:sourceDataRowCount,parsedRecordCount:records.length,sourceRowManifestSha256};
  }finally{lock.releaseLock();}
}
function kanwilLoosePayloadV1_(input){
  const x=input&&typeof input==='object'&&!Array.isArray(input)?input:{},out={};
  KANWIL_APPLICATION_FIELDS_V1.forEach(key=>{
    const value=x[key]===undefined||x[key]===null?'':String(x[key]).trim();
    if(value.length>500)throw new Error('KANWIL_FIELD_TOO_LONG: '+key);
    out[key]=value||null;
  });
  return out;
}

function listKanwilApplications(filters){
  requireBackOfficeAccess_();const ss=kanwilRequireReady_(),sheets=kanwilSheets_(ss),f=filters||{};
  const values=sheets.staging.getDataRange().getValues();if(values.length<2)return {ok:true,rows:[]};
  const h=kanwilHeader_(sheets.staging),status=String(f.state||'').trim().toUpperCase(),limit=Math.min(200,Math.max(1,Number(f.limit)||100));
  const rows=values.slice(1).filter(r=>r[h.staging_id]&&(!status||String(r[h.state]).toUpperCase()===status))
    .slice(-limit).reverse().map(r=>({stagingId:String(r[h.staging_id]),batchId:String(r[h.batch_id]),
      sourceRowNumber:Number(r[h.source_row_number]),state:String(r[h.state]),reviewState:String(r[h.review_state]),
      revision:Number(r[h.revision]),values:JSON.parse(String(r[h.normalized_values_json]||'{}')),
      validationErrors:JSON.parse(String(r[h.validation_errors_json]||'[]')),
      validationWarnings:JSON.parse(String(r[h.validation_warnings_json]||'[]')),
      fieldEvidence:(()=>{const evidence=JSON.parse(String(r[h.field_evidence_json]||'{}'));return evidence.cells||evidence;})(),
      rowGeometry:(()=>{const evidence=JSON.parse(String(r[h.field_evidence_json]||'{}'));return evidence.rowGeometry||null;})(),
      createdBy:String(r[h.created_by]),createdAt:String(r[h.created_at])}));
  return {ok:true,rows};
}
function kanwilRowsAsObjectsV1_(sheet){
  const values=sheet.getDataRange().getValues();
  if(!values.length)return [];
  const headers=values[0].map(String);
  return values.slice(1).filter(row=>row.some(value=>value!==''&&value!==null))
    .map(row=>Object.fromEntries(headers.map((key,index)=>[key,row[index]])));
}
function kanwilBuildBatchReconciliationV1_(batch,files,staging,records){
  const batchId=String(batch.batch_id||''),fileRows=(files||[]).filter(row=>String(row.batch_id||'')===batchId);
  const stageRows=(staging||[]).filter(row=>String(row.batch_id||'')===batchId);
  const stageIds=new Set(),duplicateStagingIds=[];
  stageRows.forEach(row=>{const id=String(row.staging_id||'');if(stageIds.has(id))duplicateStagingIds.push(id);stageIds.add(id);});
  const fileIds=new Set(fileRows.map(row=>String(row.file_id||'')));
  const sourceRowsExpected=fileRows.length
    ?fileRows.reduce((sum,row)=>sum+Math.max(0,Number(row.source_data_row_count!==''&&row.source_data_row_count!==undefined?row.source_data_row_count:row.source_row_count)||0),0)
    :Math.max(0,Number(batch.record_count)||0);
  const parsedRows=fileRows.length
    ?fileRows.reduce((sum,row)=>sum+Math.max(0,Number(row.parsed_record_count!==''&&row.parsed_record_count!==undefined?row.parsed_record_count:row.source_row_count)||0),0)
    :stageRows.length;
  const validRows=stageRows.filter(row=>{try{return JSON.parse(String(row.validation_errors_json||'[]')).length===0;}catch(error){return false;}}).length;
  const invalidRows=stageRows.length-validRows;
  const countState=state=>stageRows.filter(row=>String(row.state||'')===state).length;
  const committedStageRows=countState('COMMITTED');
  const committedRecords=(records||[]).filter(row=>stageIds.has(String(row.source_staging_id||'')));
  const mismatches=[];
  if(fileRows.length!==Math.max(0,Number(batch.file_count)||0))mismatches.push({code:'FILE_COUNT_MISMATCH',expected:Number(batch.file_count)||0,observed:fileRows.length});
  if(stageRows.length!==Math.max(0,Number(batch.record_count)||0))mismatches.push({code:'BATCH_RECORD_COUNT_MISMATCH',expected:Number(batch.record_count)||0,observed:stageRows.length});
  if(sourceRowsExpected!==stageRows.length)mismatches.push({code:'SOURCE_TO_STAGING_COUNT_MISMATCH',expected:sourceRowsExpected,observed:stageRows.length});
  fileRows.forEach(file=>{
    const fileStages=stageRows.filter(row=>String(row.file_id||'')===String(file.file_id||''));
    const observed=fileStages.length;
    const parsedExpected=Math.max(0,Number(file.parsed_record_count!==''&&file.parsed_record_count!==undefined?file.parsed_record_count:file.source_row_count)||0);
    const sourceExpectedRaw=file.source_data_row_count;
    const sourceExpected=sourceExpectedRaw===''||sourceExpectedRaw===undefined||sourceExpectedRaw===null?null:Number(sourceExpectedRaw);
    if(sourceExpected!==null&&Number.isFinite(sourceExpected)&&sourceExpected!==parsedExpected)
      mismatches.push({code:'SOURCE_TO_PARSER_COUNT_MISMATCH',fileId:String(file.file_id||''),expected:sourceExpected,observed:parsedExpected});
    if(observed!==parsedExpected)mismatches.push({code:'PARSER_TO_STAGING_COUNT_MISMATCH',fileId:String(file.file_id||''),expected:parsedExpected,observed});
    if(String(file.source_evidence_status||'')==='CLIENT_ATTESTED'){
      const sourceRowNumbers=fileStages.map(row=>Number(row.source_row_number));
      const manifest=kanwilHashV1_({fileSha256:String(file.source_file_sha256||''),parserVersion:String(file.parser_version||''),
        sourceDataRowCount:sourceExpected,parsedRecordCount:parsedExpected,sourceRowNumbers});
      if(manifest!==String(file.source_row_manifest_sha256||''))
        mismatches.push({code:'SOURCE_ROW_MANIFEST_MISMATCH',fileId:String(file.file_id||''),expected:String(file.source_row_manifest_sha256||''),observed:manifest});
    }else if(['CSV','EXCEL'].includes(String(batch.source_channel||'').toUpperCase())){
      mismatches.push({code:'SOURCE_EVIDENCE_UNAVAILABLE',fileId:String(file.file_id||'')});
    }
  });
  const orphanFileRows=stageRows.filter(row=>fileRows.length?!fileIds.has(String(row.file_id||'')):!!row.file_id);
  if(orphanFileRows.length)mismatches.push({code:'STAGING_FILE_REFERENCE_ORPHAN',count:orphanFileRows.length});
  if(duplicateStagingIds.length)mismatches.push({code:'DUPLICATE_STAGING_ID',ids:duplicateStagingIds});
  if(committedStageRows!==committedRecords.length)mismatches.push({code:'COMMIT_RECORD_COUNT_MISMATCH',expected:committedStageRows,observed:committedRecords.length});
  const snapshot={
    batchId,sourceRowsExpected,parsedRows,stagedRows:stageRows.length,validRows,invalidRows,
    reviewRequiredRows:countState('REVIEW_REQUIRED')+countState('VALIDATION_REQUIRED'),
    approvedRows:countState('APPROVED'),rejectedRows:countState('REJECTED'),
    committedRows:committedStageRows,fileCountExpected:Math.max(0,Number(batch.file_count)||0),
    fileCountObserved:fileRows.length,mismatches
  };
  return {status:mismatches.length?'MISMATCH':'PASS',...snapshot,snapshotSha256:kanwilHashV1_(snapshot)};
}
function reconcileKanwilBatch(batchId){
  const user=requireBackOfficeAccess_(),ss=kanwilRequireReady_(),id=String(batchId||'').trim();
  if(!id)throw new Error('KANWIL_RECONCILIATION_BATCH_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),batchRows=kanwilRowsAsObjectsV1_(sheets.batches);
    const matches=batchRows.filter(row=>String(row.batch_id||'')===id);
    if(matches.length!==1)throw new Error(matches.length?'KANWIL_BATCH_ID_NOT_UNIQUE':'KANWIL_BATCH_NOT_FOUND');
    const scope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
    if(!scope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
    if(String(matches[0].kanwil_scope_id||'').trim()!==scope)throw new Error('KANWIL_BATCH_SCOPE_MISMATCH');
    const result=kanwilBuildBatchReconciliationV1_(matches[0],kanwilRowsAsObjectsV1_(sheets.files),
      kanwilRowsAsObjectsV1_(sheets.staging),kanwilRowsAsObjectsV1_(sheets.records));
    const reconciliationId=Utilities.getUuid(),correlationId=Utilities.getUuid(),createdAt=nowIso_();
    const checkpoint=kanwilCheckpointV1_(sheets,['reconciliations','audit']);
    try{
      sheets.reconciliations.appendRow([
        reconciliationId,id,result.status,result.sourceRowsExpected,result.parsedRows,result.stagedRows,
        result.validRows,result.invalidRows,result.reviewRequiredRows,result.approvedRows,result.rejectedRows,
        result.committedRows,result.fileCountExpected,result.fileCountObserved,JSON.stringify(result.mismatches),
        result.snapshotSha256,user.email,createdAt,correlationId
      ]);
      kanwilAppendAuditV1_(sheets,id,'','',user.email,'BATCH_RECONCILIATION',
        result.status+'; '+result.mismatches.length+' mismatch(es)',correlationId);
    }catch(error){
      try{kanwilRollbackV1_(sheets,checkpoint);}catch(rollbackError){}
      throw new Error('KANWIL_RECONCILIATION_WRITE_FAILED: '+String(error&&error.message||error));
    }
    return {ok:true,reconciliationId,batchId:id,...result,createdAt,canonicalWrites:false};
  }finally{lock.releaseLock();}
}

/**
 * Read-only recovery diagnostics. This function never repairs, deletes, or rewrites
 * staging data; it returns findings and operator-reviewed next steps only.
 */
function kanwilBuildRecoveryInspectionV1_(batch,files,staging,records,events,revisions,audit){
  const batchId=String(batch.batch_id||'');
  const fileRows=(files||[]).filter(row=>String(row.batch_id||'')===batchId);
  const stageRows=(staging||[]).filter(row=>String(row.batch_id||'')===batchId);
  const stageById=new Map(),findings=[];
  const add=(severity,code,entityType,entityId,details,recommendedAction)=>
    findings.push({severity,code,entityType,entityId:String(entityId||''),details,recommendedAction});
  stageRows.forEach(row=>{
    const id=String(row.staging_id||'');
    if(!id)add('P0','STAGING_ID_MISSING','staging',batchId,'A staging row has no staging_id.','Quarantine the affected batch and reconcile its source evidence before any manual repair.');
    else if(stageById.has(id))add('P0','DUPLICATE_STAGING_ID','staging',id,'More than one staging row uses the same staging_id.','Do not commit either row; preserve both rows and resolve identity with owner-reviewed evidence.');
    else stageById.set(id,row);
  });
  const fileIds=new Set(fileRows.map(row=>String(row.file_id||'')).filter(Boolean));
  stageRows.forEach(row=>{
    const fileId=String(row.file_id||'');
    if(fileRows.length&&(!fileId||!fileIds.has(fileId)))add('P1','STAGING_FILE_REFERENCE_ORPHAN','staging',row.staging_id,'Staging row references a missing or blank file_id.','Compare the original uploaded file and batch audit before restoring the file reference.');
  });
  const fileIdsSeen=new Set();
  fileRows.forEach(row=>{
    const id=String(row.file_id||'');
    if(!id||fileIdsSeen.has(id))add('P0','FILE_ID_MISSING_OR_DUPLICATE','file',id||batchId,'File identity is blank or duplicated within the batch.','Stop intake finalization and verify file identity against its SHA-256 and parent batch.');
    fileIdsSeen.add(id);
    if(['CSV','EXCEL'].includes(String(batch.source_channel||'').toUpperCase())){
      const sourceCount=Number(row.source_data_row_count),parsedCount=Number(row.parsed_record_count);
      if(String(row.source_evidence_status||'')!=='CLIENT_ATTESTED'||!Number.isSafeInteger(sourceCount)||!Number.isSafeInteger(parsedCount))
        add('P1','SOURCE_EVIDENCE_MISSING','file',id,'Tabular source lacks complete client-attested source-row evidence.','Re-run parsing from the original file using the reviewed parser and preserve the source file hash.');
      if(Number.isFinite(sourceCount)&&Number.isFinite(parsedCount)&&sourceCount!==parsedCount)
        add('P0','SOURCE_TO_PARSER_COUNT_DRIFT','file',id,'Source data-row count '+sourceCount+' differs from parsed record count '+parsedCount+'.','Quarantine this file batch and inspect parser omissions before review or commit.');
      if(String(row.source_evidence_status||'')==='CLIENT_ATTESTED'){
        const fileStages=stageRows.filter(stage=>String(stage.file_id||'')===id);
        const sourceRowNumbers=fileStages.map(stage=>Number(stage.source_row_number));
        const manifest=kanwilHashV1_({fileSha256:String(row.source_file_sha256||''),parserVersion:String(row.parser_version||''),
          sourceDataRowCount:sourceCount,parsedRecordCount:parsedCount,sourceRowNumbers});
        if(manifest!==String(row.source_row_manifest_sha256||''))
          add('P0','SOURCE_ROW_MANIFEST_DRIFT','file',id,'Persisted source-row identities no longer match the intake manifest checksum.','Preserve the file and staging rows; compare source row numbers and original file checksum before controlled repair.');
      }
    }
  });
  const allStageIds=new Set((staging||[]).map(row=>String(row.staging_id||'')).filter(Boolean));
  const batchRevisions=(revisions||[]).filter(row=>{
    const stage=stageById.get(String(row.staging_id||''));return !!stage;
  });
  const revisionsByStage=new Map();
  (revisions||[]).forEach(row=>{
    const id=String(row.staging_id||'');
    if(!allStageIds.has(id))add('P1','REVISION_STAGING_ORPHAN','revision',row.revision_id,'Revision history references a staging_id that does not exist.','Preserve the revision row and investigate the missing staging identity; do not recreate it automatically.');
    if(stageById.has(id)){
      const list=revisionsByStage.get(id)||[];list.push(row);revisionsByStage.set(id,list);
    }
  });
  revisionsByStage.forEach((rows,id)=>{
    const nums=rows.map(row=>Number(row.revision)).sort((a,b)=>a-b);
    if(new Set(nums).size!==nums.length)add('P0','REVISION_NUMBER_DUPLICATE','revision',id,'Revision history contains duplicate revision numbers.','Freeze further corrections and compare revision payload hashes with the current staging row.');
    const current=Number(stageById.get(id).revision||1);
    if(nums.some(n=>!Number.isInteger(n)||n<2||n>current)||nums.length!==Math.max(0,current-1))
      add('P1','REVISION_SEQUENCE_GAP','revision',id,'Append-only revision history does not account for every revision up to the current staging revision.','Compare prior/current payload hashes and audit evidence before deciding whether history can be reconstructed.');
  });
  (events||[]).forEach(row=>{
    const id=String(row.staging_id||'');
    if(id&&!allStageIds.has(id))add('P1','EVENT_STAGING_ORPHAN','event',row.event_id,'Lifecycle event references a missing staging_id.','Retain the event as evidence and investigate the missing staging row; do not synthesize a replacement.');
    if(String(row.to_state||'')==='COMMITTED'&&!String(row.record_id||''))
      add('P0','COMMIT_EVENT_RECORD_MISSING','event',row.event_id,'COMMIT event has no record_id.','Block further finalization and reconcile the event with records and audit history.');
  });
  (audit||[]).filter(row=>String(row.batch_id||'')===batchId).forEach(row=>{
    const id=String(row.staging_id||'');
    if(id&&!allStageIds.has(id))add('P1','AUDIT_STAGING_ORPHAN','audit',row.audit_id,'Audit row references a missing staging_id.','Preserve audit evidence and investigate the referenced identity; do not rewrite audit history.');
  });
  const batchRecords=(records||[]).filter(row=>stageById.has(String(row.source_staging_id||'')));
  const recordsByStage=new Map();
  (records||[]).forEach(row=>{
    const id=String(row.source_staging_id||'');
    if(id&&!allStageIds.has(id))add('P1','RECORD_STAGING_ORPHAN','record',row.record_id,'Committed record references a missing staging_id.','Do not delete the record; verify the original approval and commit evidence with the owner.');
    if(stageById.has(id)){const list=recordsByStage.get(id)||[];list.push(row);recordsByStage.set(id,list);}
  });
  recordsByStage.forEach((rows,id)=>{
    if(rows.length>1)add('P0','MULTIPLE_RECORDS_FOR_STAGING','record',id,'More than one committed record references the same staging_id.','Suspend downstream use of the duplicate records and resolve against immutable commit/audit evidence.');
  });
  stageRows.forEach(row=>{
    const id=String(row.staging_id||''),state=String(row.state||''),linked=recordsByStage.get(id)||[];
    if(state==='COMMITTED'&&linked.length!==1)add('P0','COMMITTED_RECORD_CARDINALITY','staging',id,'COMMITTED staging row must have exactly one matching record; observed '+linked.length+'.','Do not recommit. Compare commit event, record, and audit evidence before a controlled repair.');
    if(state!=='COMMITTED'&&linked.length)add('P0','RECORD_WITHOUT_COMMITTED_STATE','staging',id,'A final record exists while staging state is '+state+'.','Freeze the affected record and verify whether the commit transaction partially completed.');
  });
  const keys=new Map();
  (staging||[]).forEach(row=>{
    const key=String(row.idempotency_key||'');if(!key)return;
    if(keys.has(key))add('P0','DUPLICATE_IDEMPOTENCY_KEY','staging',row.staging_id,'Idempotency key is also used by staging_id '+keys.get(key)+'.','Stop retries/import for the affected identity and resolve the duplicate without deleting evidence.');
    else keys.set(key,String(row.staging_id||''));
  });
  if(fileRows.length!==Math.max(0,Number(batch.file_count)||0))
    add('P1','BATCH_FILE_COUNT_MISMATCH','batch',batchId,'Expected '+(Number(batch.file_count)||0)+' files; observed '+fileRows.length+'.','Compare batch metadata with file rows and source upload evidence.');
  if(stageRows.length!==Math.max(0,Number(batch.record_count)||0))
    add('P1','BATCH_STAGING_COUNT_MISMATCH','batch',batchId,'Expected '+(Number(batch.record_count)||0)+' staging rows; observed '+stageRows.length+'.','Compare parser output, staging rows, and the original source file before correcting counts.');
  const recoveryPlan=findings.map((finding,index)=>({step:index+1,code:finding.code,entityType:finding.entityType,
    entityId:finding.entityId,action:finding.recommendedAction,requiresOwnerApproval:true,automatic:false}));
  return {batchId,mode:'DRY_RUN',findings,recoveryPlan,summary:{
    findingCount:findings.length,p0:findings.filter(x=>x.severity==='P0').length,
    p1:findings.filter(x=>x.severity==='P1').length,p2:findings.filter(x=>x.severity==='P2').length
  },mutationsApplied:false,canonicalWrites:false};
}
function inspectKanwilRecovery(batchId){
  const user=requireBackOfficeAccess_(),ss=kanwilRequireReady_(),id=String(batchId||'').trim();
  if(!id)throw new Error('KANWIL_RECOVERY_BATCH_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),batchRows=kanwilRowsAsObjectsV1_(sheets.batches);
    const matches=batchRows.filter(row=>String(row.batch_id||'')===id);
    if(matches.length!==1)throw new Error(matches.length?'KANWIL_BATCH_ID_NOT_UNIQUE':'KANWIL_BATCH_NOT_FOUND');
    const scope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
    if(!scope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
    if(String(matches[0].kanwil_scope_id||'').trim()!==scope)throw new Error('KANWIL_BATCH_SCOPE_MISMATCH');
    const result=kanwilBuildRecoveryInspectionV1_(matches[0],kanwilRowsAsObjectsV1_(sheets.files),
      kanwilRowsAsObjectsV1_(sheets.staging),kanwilRowsAsObjectsV1_(sheets.records),
      kanwilRowsAsObjectsV1_(sheets.events),kanwilRowsAsObjectsV1_(sheets.revisions),
      kanwilRowsAsObjectsV1_(sheets.audit));
    return {ok:true,...result,inspectedAt:nowIso_(),inspectedBy:user.email};
  }finally{lock.releaseLock();}
}

function kanwilLatestReviewEventV1_(sheets,stagingId){
  const rows=sheets.events.getDataRange().getValues(),h=kanwilHeader_(sheets.events);
  return rows.slice(1).filter(r=>String(r[h.staging_id]||'')===String(stagingId)&&
    ['REVIEW_APPROVE','REVIEW_REJECT'].includes(String(r[h.event_type]||'')))
    .sort((a,b)=>Number(b[h.event_sequence]||0)-Number(a[h.event_sequence]||0))[0]||null;
}
function reviseKanwilApplication(stagingId,expectedRevision,payload,reason){
  const user=requireBackOfficeAccess_(),ss=kanwilRequireReady_(),id=String(stagingId||'').trim(),why=String(reason||'').trim();
  const expected=Number(expectedRevision);
  if(!id||!Number.isInteger(expected)||expected<1||!why)throw new Error('KANWIL_REVISION_REQUEST_INVALID');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),rows=sheets.staging.getDataRange().getValues(),h=kanwilHeader_(sheets.staging);
    const matches=rows.map((r,i)=>({r,i})).filter(x=>x.i>0&&String(x.r[h.staging_id])===id);
    if(matches.length!==1)throw new Error(matches.length?'KANWIL_STAGING_ID_NOT_UNIQUE':'KANWIL_STAGING_NOT_FOUND');
    const {r:row,i:index}=matches[0],state=String(row[h.state]||''),currentRevision=Number(row[h.revision]||0);
    if(currentRevision!==expected)throw new Error('KANWIL_REVISION_CONFLICT');
    if(!['REJECTED','VALIDATION_REQUIRED'].includes(state))throw new Error('KANWIL_REVISION_STATE_NOT_ALLOWED');
    if(String(row[h.created_by]||'').toLowerCase()!==String(user.email||'').toLowerCase())throw new Error('KANWIL_REVISION_ACTOR_NOT_ORIGINAL_SUBMITTER');
    const latestReview=kanwilLatestReviewEventV1_(sheets,id);
    if(latestReview&&String(latestReview[kanwilHeader_(sheets.events).actor_id]||'').toLowerCase()===String(user.email||'').toLowerCase())
      throw new Error('KANWIL_SEPARATION_OF_DUTIES');
    const raw=kanwilLoosePayloadV1_(payload&&payload.values?payload.values:payload||{});
    let normalized=raw,errors=[];
    try{normalized=kanwilPayloadV1_({values:raw});}catch(error){errors.push(String(error&&error.message||error));}
    const appNo=String(normalized.nomor_permohonan||'').trim();
    if(appNo&&rows.slice(1).some((other,i)=>i+1!==index&&String(other[h.state]||'')!=='REJECTED'&&(()=>{
      let saved={};try{saved=JSON.parse(String(other[h.normalized_values_json]||'{}'));}catch(e){}
      return String(saved.nomor_permohonan||'')===appNo;
    })()))errors.push('DUPLICATE_APPLICATION_NUMBER_EXISTING');
    const nextState=errors.length?'VALIDATION_REQUIRED':'REVIEW_REQUIRED',nextRevision=currentRevision+1;
    const priorHash=String(row[h.payload_sha256]||''),nextHash=kanwilHashV1_(normalized),now=nowIso_(),correlationId=Utilities.getUuid();
    const eventCheckpoint=kanwilCheckpointV1_(sheets,['revisions','events','audit']);
    const previous={raw:row[h.raw_values_json],normalized:row[h.normalized_values_json],errors:row[h.validation_errors_json],
      warnings:row[h.validation_warnings_json],review:row[h.review_state],state:row[h.state],revision:row[h.revision],
      hash:row[h.payload_sha256],updated:row[h.updated_at]};
    try{
      sheets.revisions.appendRow([Utilities.getUuid(),id,nextRevision,priorHash,nextHash,
        String(row[h.normalized_values_json]||'{}'),JSON.stringify(normalized),kanwilSafeCellTextV1_(why),user.email,now,correlationId]);
      sheets.staging.getRange(index+1,h.raw_values_json+1).setValue(JSON.stringify(raw));
      sheets.staging.getRange(index+1,h.normalized_values_json+1).setValue(JSON.stringify(normalized));
      sheets.staging.getRange(index+1,h.validation_errors_json+1).setValue(JSON.stringify(errors));
      sheets.staging.getRange(index+1,h.validation_warnings_json+1).setValue('[]');
      sheets.staging.getRange(index+1,h.review_state+1).setValue('PENDING');
      sheets.staging.getRange(index+1,h.state+1).setValue(nextState);
      sheets.staging.getRange(index+1,h.revision+1).setValue(nextRevision);
      sheets.staging.getRange(index+1,h.payload_sha256+1).setValue(nextHash);
      sheets.staging.getRange(index+1,h.updated_at+1).setValue(now);
      kanwilAppendEventV1_(sheets,'',id,'REVISION_SUBMITTED',state,nextState,nextRevision,nextHash,user.email,why,correlationId);
      kanwilAppendAuditV1_(sheets,String(row[h.batch_id]),'',id,user.email,'REVISION_SUBMITTED',why,correlationId);
    }catch(error){
      try{
        kanwilRollbackV1_(sheets,eventCheckpoint);
        Object.entries({raw_values_json:previous.raw,normalized_values_json:previous.normalized,
          validation_errors_json:previous.errors,validation_warnings_json:previous.warnings,
          review_state:previous.review,state:previous.state,revision:previous.revision,
          payload_sha256:previous.hash,updated_at:previous.updated}).forEach(([key,value])=>
            sheets.staging.getRange(index+1,h[key]+1).setValue(value));
      }catch(rollbackError){}
      throw new Error('KANWIL_REVISION_RECOVERY_REQUIRED: '+String(error&&error.message||error));
    }
    return {ok:true,stagingId:id,revision:nextRevision,state:nextState,validationErrors:errors};
  }finally{lock.releaseLock();}
}
function reviewKanwilApplication(stagingId,decision,reason){
  const user=requireBackOfficeAccess_(),ss=kanwilRequireReady_(),id=String(stagingId||'').trim();
  const action=String(decision||'').trim().toUpperCase(),why=String(reason||'').trim();
  if(!id||!['APPROVE','REJECT'].includes(action))throw new Error('KANWIL_REVIEW_REQUEST_INVALID');
  if(!why)throw new Error('KANWIL_REVIEW_REASON_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),v=sheets.staging.getDataRange().getValues(),h=kanwilHeader_(sheets.staging);
    const index=v.findIndex((r,i)=>i>0&&String(r[h.staging_id])===id);if(index<1)throw new Error('KANWIL_STAGING_NOT_FOUND');
    const row=v[index],state=String(row[h.state]),next=action==='APPROVE'?'APPROVED':'REJECTED';
    if(state===next)return {ok:true,stagingId:id,state:next,idempotent:true};
    if(state!=='REVIEW_REQUIRED'&&!(state==='VALIDATION_REQUIRED'&&action==='REJECT'))throw new Error('KANWIL_STAGING_NOT_REVIEWABLE');
    if(String(row[h.created_by]||'').toLowerCase()===String(user.email||'').toLowerCase())throw new Error('KANWIL_SEPARATION_OF_DUTIES');
    if(action==='APPROVE'){
      let validationErrors=[];
      try{validationErrors=JSON.parse(String(row[h.validation_errors_json]||'[]'));}catch(error){throw new Error('KANWIL_VALIDATION_EVIDENCE_INVALID');}
      if(!Array.isArray(validationErrors)||validationErrors.length)throw new Error('KANWIL_VALIDATION_ERRORS_BLOCK_APPROVAL');
      let storedPayload={};
      try{storedPayload=JSON.parse(String(row[h.normalized_values_json]||'{}'));}catch(error){throw new Error('KANWIL_STAGED_PAYLOAD_INVALID');}
      let canonicalPayload;
      try{canonicalPayload=kanwilPayloadV1_({values:storedPayload});}catch(error){throw new Error('KANWIL_STAGED_PAYLOAD_INVALID: '+String(error&&error.message||error));}
      const canonicalHash=kanwilHashV1_(canonicalPayload);
      if(canonicalHash!==String(row[h.payload_sha256]||''))throw new Error('KANWIL_STAGED_PAYLOAD_HASH_MISMATCH');
    }
    const now=nowIso_(),oldReview=String(row[h.review_state]||'PENDING'),checkpoint=kanwilCheckpointV1_(sheets,['events','audit']);
    sheets.staging.getRange(index+1,h.review_state+1).setValue(next);
    sheets.staging.getRange(index+1,h.state+1).setValue(next);
    sheets.staging.getRange(index+1,h.updated_at+1).setValue(now);
    const correlationId=Utilities.getUuid(),hash=String(row[h.payload_sha256]);
    try{
      kanwilAppendEventV1_(sheets,'',id,'REVIEW_'+action,state,next,Number(row[h.revision]),hash,user.email,why,correlationId);
      kanwilAppendAuditV1_(sheets,String(row[h.batch_id]),'',id,user.email,'REVIEW_'+action,why,correlationId);
    }catch(error){
      sheets.staging.getRange(index+1,h.review_state+1).setValue(oldReview);
      sheets.staging.getRange(index+1,h.state+1).setValue(state);
      sheets.staging.getRange(index+1,h.updated_at+1).setValue(String(row[h.updated_at]||''));
      try{kanwilRollbackV1_(sheets,checkpoint);}catch(rollbackError){}
      throw new Error('KANWIL_AUDIT_WRITE_FAILED: '+String(error&&error.message||error));
    }
    return {ok:true,stagingId:id,state:next};
  }finally{lock.releaseLock();}
}
function commitKanwilApplication(stagingId,reason){
  const user=requireBackOfficeAccess_(),ss=kanwilRequireReady_(),id=String(stagingId||'').trim(),why=String(reason||'').trim();
  if(!id||!why)throw new Error('KANWIL_COMMIT_FIELDS_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),v=sheets.staging.getDataRange().getValues(),h=kanwilHeader_(sheets.staging);
    const index=v.findIndex((r,i)=>i>0&&String(r[h.staging_id])===id);if(index<1)throw new Error('KANWIL_STAGING_NOT_FOUND');
    const row=v[index],state=String(row[h.state]);
    let payload={},validationErrors=[];
    try{
      payload=JSON.parse(String(row[h.normalized_values_json]||'{}'));
      validationErrors=JSON.parse(String(row[h.validation_errors_json]||'[]'));
    }catch(error){throw new Error('KANWIL_COMMIT_EVIDENCE_INVALID');}
    if(!Array.isArray(validationErrors)||validationErrors.length)throw new Error('KANWIL_VALIDATION_ERRORS_BLOCK_COMMIT');
    let canonicalPayload;
    try{canonicalPayload=kanwilPayloadV1_({values:payload});}catch(error){throw new Error('KANWIL_COMMIT_PAYLOAD_INVALID: '+String(error&&error.message||error));}
    const canonicalHash=kanwilHashV1_(canonicalPayload);
    if(canonicalHash!==String(row[h.payload_sha256]||''))throw new Error('KANWIL_COMMIT_PAYLOAD_HASH_MISMATCH');
    payload=canonicalPayload;
    const configuredScope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
    if(!configuredScope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
    const batchValues=sheets.batches.getDataRange().getValues(),batchHeader=kanwilHeader_(sheets.batches);
    const scope=kanwilResolveBatchScopeV1_(batchValues,batchHeader,String(row[h.batch_id]),configuredScope);
    if(state==='COMMITTED')return {ok:true,stagingId:id,state:'COMMITTED',idempotent:true};
    if(state!=='APPROVED')throw new Error('KANWIL_APPROVAL_REQUIRED');
    const latestReview=kanwilLatestReviewEventV1_(sheets,id),eventHeader=kanwilHeader_(sheets.events);
    if(!latestReview||String(latestReview[eventHeader.to_state]||'')!=='APPROVED')throw new Error('KANWIL_APPROVAL_EVIDENCE_MISSING');
    if(Number(latestReview[eventHeader.revision])!==Number(row[h.revision])||
       String(latestReview[eventHeader.payload_sha256]||'')!==String(row[h.payload_sha256]||''))
      throw new Error('KANWIL_APPROVAL_EVIDENCE_STALE');
    if(String(latestReview[eventHeader.actor_id]||'').toLowerCase()===String(user.email||'').toLowerCase()||
       String(latestReview[eventHeader.actor_id]||'').toLowerCase()===String(row[h.created_by]||'').toLowerCase())
      throw new Error('KANWIL_SEPARATION_OF_DUTIES');

    const records=sheets.records.getDataRange().getValues(),rh=kanwilHeader_(sheets.records);
    if(records.slice(1).some(r=>String(r[rh.application_number])===String(payload.nomor_permohonan)))throw new Error('KANWIL_DUPLICATE_APPLICATION_NUMBER');
    const recordId=Utilities.getUuid(),correlationId=Utilities.getUuid(),now=nowIso_(),hash=String(row[h.payload_sha256]);
    const recordRow=KANWIL_STAGING_SHEETS_V1.records.map(k=>({
      record_id:recordId,kanwil_scope_id:scope,application_number:payload.nomor_permohonan,current_revision:Number(row[h.revision]),
      current_payload_sha256:hash,current_payload_json:JSON.stringify(payload),committed_at:now,committed_by:user.email,
      source_staging_id:id,correlation_id:correlationId
    }[k]??''));
    const checkpoint=kanwilCheckpointV1_(sheets,['records','events','audit']);
    const previousUpdatedAt=String(row[h.updated_at]||'');
    try{
      sheets.records.appendRow(recordRow);
      sheets.staging.getRange(index+1,h.state+1).setValue('COMMITTED');
      sheets.staging.getRange(index+1,h.review_state+1).setValue('COMMITTED');
      sheets.staging.getRange(index+1,h.updated_at+1).setValue(now);
      kanwilAppendEventV1_(sheets,recordId,id,'COMMIT','APPROVED','COMMITTED',Number(row[h.revision]),hash,user.email,why,correlationId);
      kanwilAppendAuditV1_(sheets,String(row[h.batch_id]),recordId,id,user.email,'COMMIT',why,correlationId);
    }catch(error){
      try{kanwilRollbackV1_(sheets,checkpoint);}catch(rollbackError){}
      sheets.staging.getRange(index+1,h.state+1).setValue(state);
      sheets.staging.getRange(index+1,h.review_state+1).setValue(String(row[h.review_state]||''));
      sheets.staging.getRange(index+1,h.updated_at+1).setValue(previousUpdatedAt);
      throw new Error('KANWIL_COMMIT_RECOVERY_REQUIRED: '+String(error&&error.message||error));
    }
    return {ok:true,recordId,stagingId:id,state:'COMMITTED'};
  }finally{lock.releaseLock();}
}
