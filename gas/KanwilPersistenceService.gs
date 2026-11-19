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
  return {enabled:kanwilEntryEnabled_()&&readiness.ready,configured:readiness.ready,
    reason:readiness.ready?(kanwilEntryEnabled_()?'READY':'FEATURE_FLAG_OFF'):readiness.reason,
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
      contract_version:'KANWIL_PERMIT_APPLICATION_V1',raw_values_json:JSON.stringify(p),normalized_values_json:JSON.stringify(p),
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
  const fileName=kanwilSafeCellTextV1_(String(source.name||'').replace(/[\/\\]/g,'_').slice(0,255));
  const sha=String(source.sha256||'').toLowerCase(),size=Number(source.size||0),mime=kanwilSafeCellTextV1_(String(source.mime||'').slice(0,120));
  if(!fileName||! /^[a-f0-9]{64}$/.test(sha))throw new Error('KANWIL_SOURCE_FILE_METADATA_INVALID');
  if(!Number.isSafeInteger(size)||size<1||size>20*1024*1024)throw new Error('KANWIL_SOURCE_FILE_SIZE_INVALID');
  const records=Array.isArray(x.records)?x.records:[];
  if(!records.length||records.length>500)throw new Error('KANWIL_IMPORT_ROW_LIMIT');
  const scope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
  if(!scope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
  const contractVersion='KANWIL_PERMIT_APPLICATION_V1',parserVersion=kanwilSafeCellTextV1_(String(x.parserVersion||'browser-parser-v1').slice(0,80));
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),files=sheets.files.getDataRange().getValues(),fh=kanwilHeader_(sheets.files);
    const batchRows=sheets.batches.getDataRange().getValues(),batchHeader=kanwilHeader_(sheets.batches);
    const previous=files.slice(1).find(r=>{
      if(String(r[fh.source_file_sha256]||'').toLowerCase()!==sha||String(r[fh.parser_version]||'')!==parserVersion)return false;
      const parent=batchRows.slice(1).find(b=>String(b[batchHeader.batch_id]||'')===String(r[fh.batch_id]||''));
      return !!parent&&String(parent[batchHeader.kanwil_scope_id]||'').trim()===scope&&String(parent[batchHeader.source_channel]||'').toUpperCase()===channel;
    });
    if(previous)return {ok:true,batchId:String(previous[fh.batch_id]),fileId:String(previous[fh.file_id]),idempotent:true};
    const stagingValues=sheets.staging.getDataRange().getValues(),sh=kanwilHeader_(sheets.staging);
    const existingKeys=new Map(stagingValues.slice(1).map(r=>[String(r[sh.idempotency_key]||''),String(r[sh.payload_sha256]||'')]));
    const batchId=Utilities.getUuid(),fileId=Utilities.getUuid(),correlationId=Utilities.getUuid(),now=nowIso_();
    const stageRows=[],eventRows=[],seenApplications=new Set(),seenSourceRows=new Set();
    let validCount=0,invalidCount=0;
    records.forEach((record,index)=>{
      const row=record&&typeof record==='object'?record:{},sourceRow=Number(row.sourceRowNumber||index+1);
      if(!Number.isInteger(sourceRow)||sourceRow<1)throw new Error('KANWIL_SOURCE_ROW_NUMBER_INVALID');
      if(seenSourceRows.has(sourceRow))throw new Error('KANWIL_DUPLICATE_SOURCE_ROW_NUMBER');
      seenSourceRows.add(sourceRow);
      const raw=kanwilLoosePayloadV1_(row.rawValues||row.values||row.normalizedValues||{});
      let normalized=kanwilLoosePayloadV1_(row.normalizedValues||row.values||row.rawValues||{});
      const descriptor=buildKanwilIdempotencyDescriptorV1({kanwilScopeId:scope,sourceFileSha256:sha,
        contractVersion,parserVersion,sourceRowNumber:sourceRow});
      if(!descriptor.ok)throw new Error(descriptor.reason);
      const key=descriptor.key,hash=kanwilHashV1_(normalized);
      if(existingKeys.has(key)){
        if(existingKeys.get(key)!==hash)throw new Error('KANWIL_IMPORT_IDEMPOTENCY_CONFLICT');
        return;
      }
      let errors=[];
      try{normalized=kanwilPayloadV1_({values:normalized});}
      catch(error){errors.push(String(error&&error.message||error));}
      const appNo=String(normalized.nomor_permohonan||'').trim();
      if(appNo&&seenApplications.has(appNo))errors.push('DUPLICATE_APPLICATION_NUMBER_IN_BATCH');
      if(appNo)seenApplications.add(appNo);
      if(appNo&&stagingValues.slice(1).some(r=>{
        let saved={};try{saved=JSON.parse(String(r[sh.normalized_values_json]||'{}'));}catch(e){}
        return String(saved.nomor_permohonan||'')===appNo&&String(r[sh.state]||'')!=='REJECTED';
      }))errors.push('DUPLICATE_APPLICATION_NUMBER_EXISTING');
      const warnings=Array.isArray(row.warnings)?row.warnings.slice(0,50):[];
      const state=errors.length?'VALIDATION_REQUIRED':'REVIEW_REQUIRED';
      if(errors.length)invalidCount++;else validCount++;
      const stagingId=Utilities.getUuid();
      const valuesByKey={
        staging_id:stagingId,batch_id:batchId,file_id:fileId,source_row_number:sourceRow,idempotency_key:key,
        contract_version:contractVersion,raw_values_json:JSON.stringify(raw),normalized_values_json:JSON.stringify(normalized),
        validation_errors_json:JSON.stringify(errors),validation_warnings_json:JSON.stringify(warnings),
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
    const fileValues={file_id:fileId,batch_id:batchId,source_filename:fileName,source_file_sha256:sha,
      source_file_mime:mime,source_file_size:size,source_row_count:records.length,parser_version:parserVersion,
      processing_state:'PARSED',created_by:user.email,created_at:now};
    const fileRow=KANWIL_STAGING_SHEETS_V1.files.map(k=>fileValues[k]??'');
    const checkpoint=kanwilCheckpointV1_(sheets,['batches','files','staging','events','audit']);
    try{
      sheets.batches.appendRow(batchRow);sheets.files.appendRow(fileRow);
      sheets.staging.getRange(sheets.staging.getLastRow()+1,1,stageRows.length,stageRows[0].length).setValues(stageRows);
      sheets.events.getRange(sheets.events.getLastRow()+1,1,eventRows.length,eventRows[0].length).setValues(eventRows);
      kanwilAppendAuditV1_(sheets,batchId,'','',user.email,'FILE_IMPORT','Imported '+stageRows.length+' rows; '+invalidCount+' require validation',correlationId,fileId);
    }catch(error){
      try{kanwilRollbackV1_(sheets,checkpoint);}catch(rollbackError){}
      throw new Error('KANWIL_IMPORT_WRITE_FAILED: '+String(error&&error.message||error));
    }
    return {ok:true,batchId,fileId,inserted:stageRows.length,validCount,invalidCount,state:invalidCount?'VALIDATION_REQUIRED':'REVIEW_REQUIRED'};
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
      createdBy:String(r[h.created_by]),createdAt:String(r[h.created_at])}));
  return {ok:true,rows};
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
    const row=v[index],state=String(row[h.state]),payload=JSON.parse(String(row[h.normalized_values_json]||'{}'));
    const configuredScope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
    if(!configuredScope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
    const batchValues=sheets.batches.getDataRange().getValues(),batchHeader=kanwilHeader_(sheets.batches);
    const scope=kanwilResolveBatchScopeV1_(batchValues,batchHeader,String(row[h.batch_id]),configuredScope);
    if(state==='COMMITTED')return {ok:true,stagingId:id,state:'COMMITTED',idempotent:true};
    if(state!=='APPROVED')throw new Error('KANWIL_APPROVAL_REQUIRED');
    const records=sheets.records.getDataRange().getValues(),rh=kanwilHeader_(sheets.records);
    if(records.slice(1).some(r=>String(r[rh.application_number])===String(payload.nomor_permohonan)))throw new Error('KANWIL_DUPLICATE_APPLICATION_NUMBER');
    const recordId=Utilities.getUuid(),correlationId=Utilities.getUuid(),now=nowIso_(),hash=String(row[h.payload_sha256]);
    const recordRow=KANWIL_STAGING_SHEETS_V1.records.map(k=>({
      record_id:recordId,kanwil_scope_id:scope,application_number:payload.nomor_permohonan,current_revision:Number(row[h.revision]),
      current_payload_sha256:hash,current_payload_json:JSON.stringify(payload),committed_at:now,committed_by:user.email,
      source_staging_id:id,correlation_id:correlationId
    }[k]??''));
    const checkpoint=kanwilCheckpointV1_(sheets,['records','events','audit']);
    try{
      sheets.records.appendRow(recordRow);
      sheets.staging.getRange(index+1,h.state+1).setValue('COMMITTED');
      kanwilAppendEventV1_(sheets,recordId,id,'COMMIT','APPROVED','COMMITTED',Number(row[h.revision]),hash,user.email,why,correlationId);
      kanwilAppendAuditV1_(sheets,String(row[h.batch_id]),recordId,id,user.email,'COMMIT',why,correlationId);
    }catch(error){
      try{kanwilRollbackV1_(sheets,checkpoint);}catch(rollbackError){}
      sheets.staging.getRange(index+1,h.state+1).setValue(state);
      throw new Error('KANWIL_COMMIT_RECOVERY_REQUIRED: '+String(error&&error.message||error));
    }
    return {ok:true,recordId,stagingId:id,state:'COMMITTED'};
  }finally{lock.releaseLock();}
}
