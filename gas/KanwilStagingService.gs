/**
 * Kanwil isolated staging foundation.
 * Storage provisioning/readiness helpers for the isolated Kanwil staging store.
 * RPC persistence endpoints live in KanwilPersistenceService.gs; screenshot OCR
 * is performed locally and its extracted candidate rows require human review.
 */
const KANWIL_STAGING_GUARD_V1=Object.freeze({
  enabled:false,
  featureFlagKey:'KANWIL_STAGING_ENABLED',
  spreadsheetProperty:'KANWIL_STAGING_SPREADSHEET_ID',
  timezone:'Asia/Jakarta',
  reviewOnlyScreenshot:true
});
const KANWIL_STAGING_SHEETS_V1=Object.freeze({
  batches:['batch_id','kanwil_scope_id','source_channel','contract_version','parser_version','source_exported_at','source_authorization_ref','created_by','created_at','state','file_count','record_count','correlation_id'],
  files:['file_id','batch_id','source_filename','source_file_sha256','source_file_mime','source_file_size','source_row_count','source_data_row_count','parsed_record_count','source_row_manifest_sha256','source_evidence_status','parser_version','processing_state','drive_file_id','drive_file_url','storage_status','server_verified_sha256','created_by','created_at'],
  staging:['staging_id','batch_id','file_id','source_row_number','idempotency_key','contract_version','raw_values_json','normalized_values_json','validation_errors_json','validation_warnings_json','review_state','state','revision','payload_sha256','created_by','created_at','updated_at'],
  records:['record_id','kanwil_scope_id','application_number','current_revision','current_payload_sha256','current_payload_json','committed_at','committed_by','source_staging_id','correlation_id'],
  events:['event_id','record_id','staging_id','event_sequence','event_type','from_state','to_state','revision','payload_sha256','actor_id','reason','correlation_id','occurred_at'],
  revisions:['revision_id','staging_id','revision','prior_payload_sha256','payload_sha256','prior_payload_json','payload_json','reason','actor_id','created_at','correlation_id'],
  reconciliations:['reconciliation_id','batch_id','status','source_rows_expected','parsed_rows','staged_rows','valid_rows','invalid_rows','review_required_rows','approved_rows','rejected_rows','committed_rows','file_count_expected','file_count_observed','mismatch_json','snapshot_sha256','actor_id','created_at','correlation_id'],
  audit:['audit_id','batch_id','file_id','record_id','staging_id','actor_id','action','reason','correlation_id','occurred_at']
});
function kanwilStagingSpreadsheetId_(){
  const props=PropertiesService.getScriptProperties();
  const canonical=String(props.getProperty('SPREADSHEET_ID')||'').trim();
  const staging=String(props.getProperty(KANWIL_STAGING_GUARD_V1.spreadsheetProperty)||'').trim();
  if(!canonical)throw new Error('KANWIL_CANONICAL_SPREADSHEET_NOT_CONFIGURED');
  if(!staging)throw new Error('KANWIL_STAGING_SPREADSHEET_NOT_CONFIGURED');
  if(staging===canonical)throw new Error('KANWIL_STAGING_MUST_BE_SEPARATE_FROM_CANONICAL');
  return staging;
}
function kanwilStagingReadinessV1_(){
  try{
    const id=kanwilStagingSpreadsheetId_();
    const ss=SpreadsheetApp.openById(id);
    if(!ss||String(ss.getId())!==id)return {ready:false,reason:'KANWIL_STAGING_IDENTITY_MISMATCH'};
    const required=Object.entries(KANWIL_STAGING_SHEETS_V1);
    for(const [key,headers] of required){
      const name='KANWIL_'+key.toUpperCase();
      const sh=ss.getSheetByName(name);
      if(!sh||sh.getLastRow()<1||sh.getLastColumn()!==headers.length)return {ready:false,reason:'KANWIL_SCHEMA_MISSING_OR_MISMATCH',sheet:name};
      const actual=sh.getRange(1,1,1,headers.length).getValues()[0].map(String);
      if(actual.join('|')!==headers.join('|')||sh.getFrozenRows()!==1)return {ready:false,reason:'KANWIL_SCHEMA_MISSING_OR_MISMATCH',sheet:name};
    }
    return {ready:true,enabled:kanwilEntryEnabled_(),writeEndpointsExposed:true};
  }catch(error){return {ready:false,reason:String(error&&error.message||error)};}
}
/**
 * Explicit provisioning helper for a future reviewed admin workflow.
 * Does not create a spreadsheet or alter canonical storage. It stores the dedicated
 * staging ID in Script Properties only after all configured staging schemas validate.
 */
function provisionKanwilStagingSchema_(stagingSpreadsheetId){
  requireBackOfficeAccess_();
  const id=String(stagingSpreadsheetId||'').trim();
  const canonical=String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')||'').trim();
  if(!id)throw new Error('KANWIL_STAGING_SPREADSHEET_ID_REQUIRED');
  if(!canonical||id===canonical)throw new Error('KANWIL_STAGING_MUST_BE_SEPARATE_FROM_CANONICAL');
  const ss=SpreadsheetApp.openById(id);
  if(!ss||String(ss.getId())!==id)throw new Error('KANWIL_STAGING_IDENTITY_MISMATCH');
  // Preflight every existing tab before creating or modifying any schema.
  // A mismatch in a later tab must not leave earlier missing tabs partially provisioned.
  Object.entries(KANWIL_STAGING_SHEETS_V1).forEach(([key,headers])=>{
    const name='KANWIL_'+key.toUpperCase(),sh=ss.getSheetByName(name);
    if(!sh||sh.getLastRow()===0)return;
    const actual=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
    if(key==='files'){
      const legacy=['file_id','batch_id','source_filename','source_file_sha256','source_file_mime','source_file_size','source_row_count','source_data_row_count','parsed_record_count','source_row_manifest_sha256','source_evidence_status','parser_version','processing_state','created_by','created_at'];
      if(actual.join('|')===legacy.join('|'))return; // Safe additive migration is applied only after every tab passes preflight.
    }
    if(sh.getLastColumn()!==headers.length||actual.join('|')!==headers.join('|'))throw new Error('KANWIL_SCHEMA_MISMATCH:'+name);
  });
  Object.entries(KANWIL_STAGING_SHEETS_V1).forEach(([key,headers])=>{
    const name='KANWIL_'+key.toUpperCase();
    let sh=ss.getSheetByName(name);
    if(!sh)sh=ss.insertSheet(name);
    if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);
    let actual=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
    if(key==='files'&&actual.length===15){
      const legacy=['file_id','batch_id','source_filename','source_file_sha256','source_file_mime','source_file_size','source_row_count','source_data_row_count','parsed_record_count','source_row_manifest_sha256','source_evidence_status','parser_version','processing_state','created_by','created_at'];
      if(actual.join('|')!==legacy.join('|'))throw new Error('KANWIL_SCHEMA_MISMATCH:'+name);
      const additions=['drive_file_id','drive_file_url','storage_status','server_verified_sha256'];
      sh.getRange(1,16,1,additions.length).setValues([additions]);
      const last=sh.getLastRow();
      if(last>1)sh.getRange(2,16,last-1,4).setValues(Array.from({length:last-1},()=>['','','LEGACY_NOT_ARCHIVED','']));
      actual=sh.getRange(1,1,1,headers.length).getValues()[0].map(String);
    }
    if(actual.join('|')!==headers.join('|'))throw new Error('KANWIL_SCHEMA_MISMATCH:'+name);
    sh.setFrozenRows(1);
  });
  // Persist the dedicated target only after all configured schema headers validate.
  // This function must be run explicitly by an authorized back-office owner.
  PropertiesService.getScriptProperties().setProperty(KANWIL_STAGING_GUARD_V1.spreadsheetProperty,id);
  return kanwilStagingReadinessV1_();
}
/**
 * Owner-run provisioning entrypoint. Reads the dedicated spreadsheet ID from
 * Script Properties so the Apps Script editor can invoke this without arguments.
 * Protected by the same back-office guard as the internal provisioning helper.
 */
/**
 * One-time owner activation for the explicitly supplied Kanwil storage targets.
 * Run from the Apps Script editor as an authorized back-office administrator.
 * It provisions the isolated spreadsheet, proves Drive write access with a
 * temporary file that is immediately trashed, and enables the feature flag last.
 */
function activateKanwilStorageFromOwnerTargetsV1(){
  requireBackOfficeAccess_();
  requirePermission_('admin.config');
  const stagingId='1hK0ClWkKcUhvne7yXYXYqvMQW7L-R2tuGOTVyzSVBWE';
  const driveFolderId='13cIXTqgXUaxpYLlCXaE9hiNLHu2xZYTN';
  const scopeId='KANWIL_JABAR';
  const props=PropertiesService.getScriptProperties();
  const canonicalId=String(props.getProperty('SPREADSHEET_ID')||'').trim();
  if(!canonicalId||canonicalId===stagingId)throw new Error('KANWIL_STAGING_MUST_BE_SEPARATE_FROM_CANONICAL');
  const staging=SpreadsheetApp.openById(stagingId);
  if(!staging||String(staging.getId())!==stagingId)throw new Error('KANWIL_STAGING_IDENTITY_MISMATCH');
  const folder=DriveApp.getFolderById(driveFolderId);
  if(!folder||String(folder.getId())!==driveFolderId)throw new Error('KANWIL_DRIVE_FOLDER_IDENTITY_MISMATCH');
  // Keep all writes disabled until both resources pass real access checks.
  props.setProperties({
    KANWIL_STAGING_SPREADSHEET_ID:stagingId,
    KANWIL_SCOPE_ID:scopeId,
    KANWIL_DRIVE_FOLDER_ID:driveFolderId,
    KANWIL_STAGING_ENABLED:'false'
  },false);
  const schema=provisionKanwilStagingSchema_(stagingId);
  if(!schema.ready)throw new Error('KANWIL_STAGING_PROVISIONING_FAILED');
  let probe=null;
  try{
    probe=folder.createFile(Utilities.newBlob('INTAL Kanwil Drive permission preflight','text/plain','.kanwil-drive-preflight-'+Utilities.getUuid()+'.txt'));
    if(!probe||!probe.getId())throw new Error('KANWIL_DRIVE_WRITE_PREFLIGHT_FAILED');
    probe.setTrashed(true);
    if(!probe.isTrashed())throw new Error('KANWIL_DRIVE_PREFLIGHT_CLEANUP_FAILED');
  }catch(error){
    props.setProperty('KANWIL_STAGING_ENABLED','false');
    throw new Error('KANWIL_DRIVE_WRITE_PREFLIGHT_FAILED: '+String(error&&error.message||error));
  }
  // Enable only after schema and actual Drive write permission are proven.
  props.setProperty('KANWIL_STAGING_ENABLED','true');
  return {
    ok:true,enabled:true,scopeId,
    stagingSpreadsheetId:stagingId,
    driveFolderId,
    schemaReady:true,driveWriteVerified:true,
    canonicalWrites:false
  };
}
function provisionKanwilStagingFromConfiguredId(){
  requireBackOfficeAccess_();
  requirePermission_('admin.config');
  const id=String(PropertiesService.getScriptProperties().getProperty(KANWIL_STAGING_GUARD_V1.spreadsheetProperty)||'').trim();
  if(!id)throw new Error('KANWIL_STAGING_SPREADSHEET_NOT_CONFIGURED');
  return provisionKanwilStagingSchema_(id);
}
