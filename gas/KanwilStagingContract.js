/**
 * Kanwil Permit v1 — shared staging envelope and guarded state transitions.
 * Pure staging envelope and transition helpers. Persistence is implemented in KanwilPersistenceService.gs.
 */
const KANWIL_REVIEW_ONLY_V1=false;
const KANWIL_STAGING_FIELD_KEYS_V1=['tanggal_pembayaran','tanggal_mulai_verifikasi','tanggal_auto_terbit','layanan','kategori_produk','nomor_permohonan','tanggal_permohonan','penjamin','nama','jenis_kelamin','tanggal_lahir','kebangsaan','no_passport','jenis_produk','tujuan','posisi_permohonan','status_permohonan'];
const KANWIL_STAGING_STATES_V1=['RECEIVED','PARSED','VALIDATION_REQUIRED','REVIEW_REQUIRED','APPROVED','COMMITTED','REJECTED','DUPLICATE','CONFLICT','FAILED','CANCELLED'];
const KANWIL_STAGING_TRANSITIONS_V1={
  RECEIVED:['PARSED','FAILED','CANCELLED'],
  PARSED:['VALIDATION_REQUIRED','REVIEW_REQUIRED','REJECTED','FAILED'],
  VALIDATION_REQUIRED:['REVIEW_REQUIRED','REJECTED','FAILED'],
  REVIEW_REQUIRED:['APPROVED','REJECTED','DUPLICATE','CONFLICT'],
  APPROVED:['COMMITTED','CANCELLED'],
  COMMITTED:[],
  REJECTED:[],
  DUPLICATE:[],
  CONFLICT:['REVIEW_REQUIRED','REJECTED'],
  FAILED:['RECEIVED','CANCELLED'],
  CANCELLED:[]
};
function createKanwilStagingEnvelopeV1(input) {
  const x=input||{};
  if(!x.batchId||!x.fileId||!x.sourceChannel||!x.sourceRowNumber||!x.contractVersion)
    return {ok:false,reason:'STAGING_ENVELOPE_REQUIRED_FIELDS_MISSING'};
  if(!['MANUAL','EXCEL','CSV','SCREENSHOT','CAMERA_PHOTO'].includes(x.sourceChannel))
    return {ok:false,reason:'SOURCE_CHANNEL_INVALID'};
  if(!x.rawValues||!x.normalizedValues||!x.fieldEvidence)
    return {ok:false,reason:'STAGING_EVIDENCE_REQUIRED'};
  const raw={},normalized={},evidence={};
  KANWIL_STAGING_FIELD_KEYS_V1.forEach(key=>{
    raw[key]=Object.prototype.hasOwnProperty.call(x.rawValues,key)?String(x.rawValues[key]??''):null;
    normalized[key]=Object.prototype.hasOwnProperty.call(x.normalizedValues,key)?(x.normalizedValues[key]===null?null:String(x.normalizedValues[key])):null;
    evidence[key]=x.fieldEvidence[key]||null;
  });
  return {ok:true,envelope:{
    recordId:x.recordId||null,batchId:String(x.batchId),fileId:String(x.fileId),
    sourceChannel:x.sourceChannel,sourceRowNumber:Number(x.sourceRowNumber),
    contractVersion:String(x.contractVersion),rawValues:raw,normalizedValues:normalized,
    fieldEvidence:evidence,validationErrors:(x.validationErrors||[]).slice(),
    validationWarnings:(x.validationWarnings||[]).slice(),
    duplicateState:x.duplicateState||'UNCHECKED',reviewState:'PENDING',
    commitState:'NOT_COMMITTED',revision:Number(x.revision||1),
    state:'RECEIVED',createdAt:x.createdAt||null,updatedAt:x.updatedAt||null
  }};
}
function transitionKanwilStagingV1(currentState,nextState,reason) {
  if(!KANWIL_STAGING_STATES_V1.includes(currentState)||!KANWIL_STAGING_STATES_V1.includes(nextState))
    return {ok:false,reason:'STAGING_STATE_UNKNOWN'};
  if(!(KANWIL_STAGING_TRANSITIONS_V1[currentState]||[]).includes(nextState))
    return {ok:false,reason:'STAGING_TRANSITION_NOT_ALLOWED'};
  if(['REJECTED','CANCELLED','CONFLICT'].includes(nextState)&&!String(reason||'').trim())
    return {ok:false,reason:'STAGING_DECISION_REASON_REQUIRED'};
  if(nextState==='COMMITTED'&&currentState!=='APPROVED')
    return {ok:false,reason:'HUMAN_APPROVAL_REQUIRED'};
  return {ok:true,from:currentState,to:nextState,reason:String(reason||'').trim()||null};
}
function kanwilDuplicateFingerprintV1_(kanwilScopeId,applicationNumber) {
  const scope=String(kanwilScopeId||'').trim(),number=String(applicationNumber||'').trim();
  if(!scope||!number)return {ok:false,reason:'DUPLICATE_SCOPE_OR_APPLICATION_NUMBER_MISSING'};
  return {ok:true,fingerprint:scope+'::'+number};
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_REVIEW_ONLY_V1,KANWIL_STAGING_STATES_V1,KANWIL_STAGING_TRANSITIONS_V1,createKanwilStagingEnvelopeV1,transitionKanwilStagingV1,kanwilDuplicateFingerprintV1_};
