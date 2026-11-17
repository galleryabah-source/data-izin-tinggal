/**
 * Kanwil Permit v1 — persistence boundary contract.
 * Pure definitions and validators only: no Sheets/Drive/RPC side effects.
 * Google Sheets adapter must serialize transitions with a lock and reconcile
 * partial multi-sheet writes; this is NOT an ACID transaction implementation.
 */
const KANWIL_STORAGE_SCHEMAS_V1 = Object.freeze({
  KANWIL_IMPORT_BATCHES:['batch_id','kanwil_scope_id','source_channel','source_exported_at','source_authorization_ref','contract_version','parser_version','created_by','created_at','state','file_count','record_count','approved_count','committed_count','rejected_count','correlation_id'],
  KANWIL_IMPORT_FILES:['file_id','batch_id','source_filename','source_file_sha256','source_file_mime','source_file_size','private_drive_file_id','source_row_count','parser_version','processing_state','error_code','created_at','created_by'],
  KANWIL_APPLICATION_STAGING:['staging_id','batch_id','file_id','source_row_number','idempotency_key','contract_version','raw_values_json','normalized_values_json','field_evidence_json','validation_errors_json','validation_warnings_json','duplicate_state','review_state','commit_state','state','revision','payload_sha256','created_at','updated_at'],
  KANWIL_APPLICATION_RECORDS:['record_id','kanwil_scope_id','application_number','current_revision','current_payload_sha256','current_payload_json','committed_at','committed_by','source_staging_id','correlation_id'],
  KANWIL_APPLICATION_EVENTS:['event_id','record_id','staging_id','event_sequence','event_type','from_state','to_state','revision','payload_sha256','actor_id','reason','correlation_id','occurred_at'],
  KANWIL_IMPORT_AUDIT:['audit_id','batch_id','file_id','record_id','staging_id','actor_id','action','reason','before_ref','after_ref','correlation_id','occurred_at']
});
const KANWIL_STORAGE_REQUIRED_BATCH_FIELDS_V1=['batchId','kanwilScopeId','sourceChannel','contractVersion','parserVersion','createdBy','correlationId'];
const KANWIL_STORAGE_CHANNELS_V1=['EXCEL','CSV','SCREENSHOT','CAMERA_PHOTO'];
function createKanwilBatchDescriptorV1(input){
  const x=input||{};
  for(const key of KANWIL_STORAGE_REQUIRED_BATCH_FIELDS_V1)if(!String(x[key]||'').trim())return {ok:false,reason:'BATCH_FIELD_REQUIRED:'+key};
  if(!KANWIL_STORAGE_CHANNELS_V1.includes(x.sourceChannel))return {ok:false,reason:'SOURCE_CHANNEL_INVALID'};
  return {ok:true,batch:{
    batch_id:String(x.batchId),kanwil_scope_id:String(x.kanwilScopeId),
    source_channel:x.sourceChannel,source_exported_at:x.sourceExportedAt||null,
    source_authorization_ref:String(x.sourceAuthorizationRef||''),
    contract_version:String(x.contractVersion),parser_version:String(x.parserVersion),
    created_by:String(x.createdBy),created_at:x.createdAt||null,state:'CREATED',
    correlation_id:String(x.correlationId)
  }};
}
/**
 * Idempotency is tied to immutable source bytes + parser contract + physical row.
 * The caller must provide a real SHA-256; this module never pretends to hash.
 */
function buildKanwilIdempotencyDescriptorV1(input){
  const x=input||{};
  const required=['kanwilScopeId','sourceFileSha256','contractVersion','parserVersion','sourceRowNumber'];
  for(const key of required)if(x[key]===undefined||x[key]===null||String(x[key]).trim()==='')return {ok:false,reason:'IDEMPOTENCY_FIELD_REQUIRED:'+key};
  const checksum=String(x.sourceFileSha256).toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(checksum))return {ok:false,reason:'SOURCE_SHA256_INVALID'};
  const row=Number(x.sourceRowNumber);
  if(!Number.isInteger(row)||row<1)return {ok:false,reason:'SOURCE_ROW_NUMBER_INVALID'};
  return {ok:true,key:[String(x.kanwilScopeId),checksum,String(x.contractVersion),String(x.parserVersion),String(row)].join('|')};
}
function validateKanwilRevisionAppendV1(input){
  const x=input||{};
  if(!x.recordId||!x.actorId||!x.correlationId||!x.payloadSha256)return {ok:false,reason:'REVISION_AUDIT_FIELDS_REQUIRED'};
  if(!/^[a-f0-9]{64}$/i.test(String(x.payloadSha256)))return {ok:false,reason:'PAYLOAD_SHA256_INVALID'};
  const current=Number(x.currentRevision||0),next=Number(x.nextRevision);
  if(!Number.isInteger(current)||current<0||!Number.isInteger(next)||next!==current+1)return {ok:false,reason:'REVISION_SEQUENCE_INVALID'};
  if(!String(x.reason||'').trim())return {ok:false,reason:'REVISION_REASON_REQUIRED'};
  if(x.expectedCurrentPayloadSha256!==undefined&&x.actualCurrentPayloadSha256!==x.expectedCurrentPayloadSha256)return {ok:false,reason:'REVISION_BASELINE_MISMATCH'};
  return {ok:true,revision:{record_id:String(x.recordId),revision:next,payload_sha256:String(x.payloadSha256).toLowerCase(),actor_id:String(x.actorId),reason:String(x.reason).trim(),correlation_id:String(x.correlationId)}};
}
function validateKanwilAuditEventV1(input){
  const x=input||{};
  for(const key of ['auditId','actorId','action','reason','correlationId','occurredAt'])if(!String(x[key]||'').trim())return {ok:false,reason:'AUDIT_FIELD_REQUIRED:'+key};
  return {ok:true,event:{audit_id:String(x.auditId),batch_id:x.batchId||null,file_id:x.fileId||null,record_id:x.recordId||null,staging_id:x.stagingId||null,actor_id:String(x.actorId),action:String(x.action),reason:String(x.reason).trim(),before_ref:x.beforeRef||null,after_ref:x.afterRef||null,correlation_id:String(x.correlationId),occurred_at:String(x.occurredAt)}};
}
function classifyKanwilDuplicateCandidateV1(existing, incoming){
  if(!existing||!incoming||!existing.kanwilScopeId||!incoming.kanwilScopeId||!existing.applicationNumber||!incoming.applicationNumber)return {ok:false,reason:'DUPLICATE_IDENTITY_INCOMPLETE'};
  if(String(existing.kanwilScopeId)!==String(incoming.kanwilScopeId)||String(existing.applicationNumber)!==String(incoming.applicationNumber))return {ok:true,candidate:false,outcome:'NO_MATCH'};
  const same=String(existing.payloadSha256||'')===String(incoming.payloadSha256||'');
  return {ok:true,candidate:true,outcome:same?'IDENTICAL_PAYLOAD_CANDIDATE':'PAYLOAD_CONFLICT_CANDIDATE',enforceUnique:false,requiresHumanResolution:true};
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_STORAGE_SCHEMAS_V1,createKanwilBatchDescriptorV1,buildKanwilIdempotencyDescriptorV1,validateKanwilRevisionAppendV1,validateKanwilAuditEventV1,classifyKanwilDuplicateCandidateV1};
