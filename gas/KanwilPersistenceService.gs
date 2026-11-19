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
    if(normalized[key]&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(normalized[key]))throw new Error('KANWIL_DATE_INVALID: '+key);
  });
  ['tanggal_pembayaran','tanggal_mulai_verifikasi','tanggal_auto_terbit','tanggal_permohonan'].forEach(key=>{
    if(normalized[key]&&!/^\\d{4}-\\d{2}-\\d{2}(?:[ T]\\d{2}:\\d{2}(?::\\d{2})?)?$/.test(normalized[key]))
      throw new Error('KANWIL_DATETIME_INVALID: '+key);
  });
  return normalized;
}
function kanwilHashV1_(value){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value),Utilities.Charset.UTF_8);
  return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');
}
function kanwilAppendEventV1_(sheets,recordId,stagingId,eventType,fromState,toState,revision,hash,actor,reason,correlationId){
  sheets.events.appendRow([Utilities.getUuid(),recordId||'',stagingId||'',1,eventType,fromState||'',toState,
    revision,hash,actor,reason||'',correlationId,nowIso_()]);
}
function kanwilAppendAuditV1_(sheets,batchId,recordId,stagingId,actor,action,reason,correlationId){
  sheets.audit.appendRow([Utilities.getUuid(),batchId||'', '',recordId||'',stagingId||'',actor,action,reason||'',
    '', '',correlationId,nowIso_()]);
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
  const reason=String(payload&&payload.sourceReason||'MANUAL_ENTRY').trim().slice(0,250);
  const scope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
  if(!scope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
  const hash=kanwilHashV1_(p),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheets=kanwilSheets_(ss),values=sheets.staging.getDataRange().getValues(),h=kanwilHeader_(sheets.staging);
    const existing=values.slice(1).find(r=>String(r[h.idempotency_key]||'')===submissionId);
    if(existing){
      if(String(existing[h.payload_sha256]||'')!==hash)throw new Error('KANWIL_IDEMPOTENCY_CONFLICT');
      return {ok:true,stagingId:String(existing[h.staging_id]),state:String(existing[h.state]),idempotent:true};
    }
    const batchId=Utilities.getUuid(),fileId=Utilities.getUuid(),stagingId=Utilities.getUuid(),correlationId=Utilities.getUuid(),now=nowIso_();
    const batchHeaders=kanwilHeader_(sheets.batches);
    const batchRow=KANWIL_STAGING_SHEETS_V1.batches.map(k=>({
      batch_id:batchId,kanwil_scope_id:scope,source_channel:'MANUAL',contract_version:'KANWIL_PERMIT_APPLICATION_V1',
      parser_version:'manual-v1',created_by:user.email,created_at:now,state:'REVIEW_REQUIRED',
      file_count:0,record_count:1,correlation_id:correlationId
    }[k]??''));
    const stagingRow=KANWIL_STAGING_SHEETS_V1.staging.map(k=>({
      staging_id:stagingId,batch_id:batchId,file_id:fileId,source_row_number:1,idempotency_key:submissionId,
      contract_version:'KANWIL_PERMIT_APPLICATION_V1',raw_values_json:JSON.stringify(p),normalized_values_json:JSON.stringify(p),
      validation_errors_json:'[]',validation_warnings_json:'[]',review_state:'PENDING',revision:1,
      payload_sha256:hash,created_by:user.email,created_at:now,updated_at:now
    }[k]??''));
    const duplicate=values.slice(1).some(r=>String(r[h.application_number]||'')===p.nomor_permohonan&&String(r[h.state]||'')!=='REJECTED');
    if(duplicate)throw new Error('KANWIL_DUPLICATE_APPLICATION_NUMBER');
    const appended=[];
    try{
      sheets.batches.appendRow(batchRow);appended.push([sheets.batches,sheets.batches.getLastRow()]);
      sheets.staging.appendRow(stagingRow);appended.push([sheets.staging,sheets.staging.getLastRow()]);
      kanwilAppendEventV1_(sheets,'',stagingId,'INTAKE_CREATED','', 'REVIEW_REQUIRED',1,hash,user.email,reason,correlationId);
      kanwilAppendAuditV1_(sheets,batchId,'',stagingId,user.email,'INTAKE_CREATED',reason,correlationId);
    }catch(error){
      for(let i=appended.length-1;i>=0;i--)try{appended[i][0].deleteRow(appended[i][1]);}catch(rollbackError){}
      throw new Error('KANWIL_STAGING_WRITE_FAILED: '+String(error&&error.message||error));
    }
    return {ok:true,batchId,stagingId,state:'REVIEW_REQUIRED',idempotent:false};
  }finally{lock.releaseLock();}
}
function listKanwilApplications(filters){
  requireBackOfficeAccess_();const ss=kanwilRequireReady_(),sheets=kanwilSheets_(ss),f=filters||{};
  const values=sheets.staging.getDataRange().getValues();if(values.length<2)return {ok:true,rows:[]};
  const h=kanwilHeader_(sheets.staging),status=String(f.state||'').trim().toUpperCase(),limit=Math.min(200,Math.max(1,Number(f.limit)||100));
  const rows=values.slice(1).filter(r=>r[h.staging_id]&&(!status||String(r[h.state]).toUpperCase()===status))
    .slice(-limit).reverse().map(r=>({stagingId:String(r[h.staging_id]),batchId:String(r[h.batch_id]),
      sourceRowNumber:Number(r[h.source_row_number]),state:String(r[h.state]),reviewState:String(r[h.review_state]),
      revision:Number(r[h.revision]),values:JSON.parse(String(r[h.normalized_values_json]||'{}')),
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
    if(state!=='REVIEW_REQUIRED')throw new Error('KANWIL_STAGING_NOT_REVIEWABLE');
    const now=nowIso_(),reasonCell=h.review_state;
    sheets.staging.getRange(index+1,reasonCell+1).setValue(next);
    sheets.staging.getRange(index+1,h.updated_at+1).setValue(now);
    const correlationId=Utilities.getUuid(),hash=String(row[h.payload_sha256]);
    try{
      kanwilAppendEventV1_(sheets,'',id,'REVIEW_'+action,state,next,Number(row[h.revision]),hash,user.email,why,correlationId);
      kanwilAppendAuditV1_(sheets,String(row[h.batch_id]),'',id,user.email,'REVIEW_'+action,why,correlationId);
    }catch(error){
      sheets.staging.getRange(index+1,reasonCell+1).setValue('PENDING');
      sheets.staging.getRange(index+1,h.updated_at+1).setValue(String(row[h.updated_at]||''));
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
    const scope=String(PropertiesService.getScriptProperties().getProperty('KANWIL_SCOPE_ID')||'').trim();
    if(!scope)throw new Error('KANWIL_SCOPE_ID_NOT_CONFIGURED');
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
    const appended=[];
    try{
      sheets.records.appendRow(recordRow);appended.push([sheets.records,sheets.records.getLastRow()]);
      sheets.staging.getRange(index+1,h.state+1).setValue('COMMITTED');
      kanwilAppendEventV1_(sheets,recordId,id,'COMMIT','APPROVED','COMMITTED',Number(row[h.revision]),hash,user.email,why,correlationId);
      kanwilAppendAuditV1_(sheets,String(row[h.batch_id]),recordId,id,user.email,'COMMIT',why,correlationId);
    }catch(error){
      for(let i=appended.length-1;i>=0;i--)try{appended[i][0].deleteRow(appended[i][1]);}catch(rollbackError){}
      sheets.staging.getRange(index+1,h.state+1).setValue(state);
      throw new Error('KANWIL_COMMIT_RECOVERY_REQUIRED: '+String(error&&error.message||error));
    }
    return {ok:true,recordId,stagingId:id,state:'COMMITTED'};
  }finally{lock.releaseLock();}
}
