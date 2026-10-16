/**
 * Phase 9 — Daily operational input v1.
 * Strictly isolated from canonical monthly datasets/import/registry paths.
 * Activation requires BOTH DAILY_INPUT_ENABLED=true and DAILY_INPUT_GATE_9_1=PASS
 * in CONFIG. No code path may silently coerce missing measures to zero.
 */
const DAILY_SERVICE_CONTRACTS_V1 = Object.freeze({
  RESIDENCE_PERMIT: Object.freeze({
    serviceFamily:'RESIDENCE_PERMIT',datasetKey:'RESIDENCE_PERMIT_SERVICE_DAILY',
    version:'candidate-v1',sourceContractKey:'RESIDENCE_PERMIT_SERVICE_MONTHLY',
    measures:Object.freeze(['bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim'])
  }),
  PASSPORT: Object.freeze({
    serviceFamily:'PASSPORT',datasetKey:'PASSPORT_SERVICE_DAILY',
    version:'candidate-v1',sourceContractKey:'PASSPORT_SERVICE_MONTHLY',
    measures:Object.freeze(['biasa_24','biasa_48','elektronik_48','e_polikarbonat'])
  })
});
const DAILY_INPUT_GUARD_V1 = Object.freeze({
  enabled:false,timezone:'Asia/Jakarta',featureFlagKey:'DAILY_INPUT_ENABLED',
  gateKey:'DAILY_INPUT_GATE_9_1',countingBasis:'SERVICE_COMPLETED_OR_DOCUMENT_ISSUED',
  lateEntryPolicy:'ALLOW_WITH_ORIGINAL_OPERATIONAL_DATE_REASON_AND_AUDIT'
});
const DAILY_INPUT_HEADERS_V1 = Object.freeze([
  'record_id','submission_id','service_family','operational_date','office_key','office_name',
  'contract_version','revision','status','measures_json','total','source_record_id',
  'source_submission_id','created_by','created_at','updated_by','updated_at',
  'submitted_by','submitted_at','reviewed_by','reviewed_at','decision_reason',
  'correction_reason','payload_hash','late_entry_reason'
]);
function dailyConfig_(){
  const sh=getDb_().getSheetByName(SHEETS.CONFIG), rows=sh?sh.getDataRange().getValues().slice(1):[];
  const result={};
  rows.forEach(r=>{const k=String(r[0]||'').trim();if(k)result[k]=String(r[1]||'').trim();});
  return result;
}
function dailyStagingId_(){
  const props=PropertiesService.getScriptProperties();
  const canonicalId=String(props.getProperty('SPREADSHEET_ID')||'').trim();
  const stagingId=String(props.getProperty('DAILY_STAGING_SPREADSHEET_ID')||'').trim();
  if(!canonicalId)throw new Error('DAILY_CANONICAL_SPREADSHEET_NOT_CONFIGURED');
  if(!stagingId)throw new Error('DAILY_STAGING_SPREADSHEET_NOT_CONFIGURED');
  if(stagingId===canonicalId)throw new Error('DAILY_STAGING_MUST_BE_SEPARATE_FROM_CANONICAL');
  return stagingId;
}
function dailyStagingReady_(){try{dailyStagingId_();return true;}catch(e){return false;}}
function getDailyStagingDb_(){return SpreadsheetApp.openById(dailyStagingId_());}
function dailyAppendAudit_(user,action,datasetKey,batchId,affectedRows,status,details){
  const ss=getDailyStagingDb_(),name='DAILY_INPUT_AUDIT';
  let sh=ss.getSheetByName(name);
  const headers=['event_id','timestamp','actor','action','dataset_key','correlation_id','affected_rows','status','details'];
  if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);}
  const actual=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  if(actual.join('|')!==headers.join('|'))throw new Error('DAILY_AUDIT_SCHEMA_MISMATCH');
  sh.appendRow([Utilities.getUuid(),nowIso_(),String(user&&user.email||''),action,datasetKey,batchId,affectedRows,status,String(details||'')]);
}
function getDailyInputPolicyV1(){
  requirePermission_('daily.read');
  const stagingReady=dailyStagingReady_();
  const c=dailyConfig_(),families=Object.keys(DAILY_SERVICE_CONTRACTS_V1).map(k=>({
    serviceFamily:DAILY_SERVICE_CONTRACTS_V1[k].serviceFamily,
    datasetKey:DAILY_SERVICE_CONTRACTS_V1[k].datasetKey,
    contractVersion:DAILY_SERVICE_CONTRACTS_V1[k].version,
    measureCount:DAILY_SERVICE_CONTRACTS_V1[k].measures.length
  }));
  return {contract:'DAILY_INPUT_POLICY_V1',enabled:DAILY_INPUT_GUARD_V1.enabled&&String(c[DAILY_INPUT_GUARD_V1.featureFlagKey]||'').toLowerCase()==='true'&&String(c[DAILY_INPUT_GUARD_V1.gateKey]||'').toUpperCase()==='PASS'&&stagingReady,
    gateStatus:String(c[DAILY_INPUT_GUARD_V1.gateKey]||'BLOCKED').toUpperCase(),stagingReady,timezone:DAILY_INPUT_GUARD_V1.timezone,
    countingBasis:DAILY_INPUT_GUARD_V1.countingBasis,lateEntryPolicy:DAILY_INPUT_GUARD_V1.lateEntryPolicy,serviceFamilies:families};
}
function assertDailyInputEnabled_(){
  const p=getDailyInputPolicyV1();
  if(!p.enabled)throw new Error('DAILY_INPUT_GATE_BLOCKED: Gate 9.1 must be PASS and DAILY_INPUT_ENABLED=true.');
  return p;
}
function getDailyServiceContractV1(serviceFamily){
  requirePermission_('daily.read');
  const key=String(serviceFamily||'').trim().toUpperCase(),c=DAILY_SERVICE_CONTRACTS_V1[key];
  if(!c)throw new Error('DAILY_SERVICE_FAMILY_INVALID');
  return {contract:'DAILY_SERVICE_CONTRACT_V1',serviceFamily:c.serviceFamily,datasetKey:c.datasetKey,version:c.version,
    timezone:DAILY_INPUT_GUARD_V1.timezone,countingBasis:DAILY_INPUT_GUARD_V1.countingBasis,
    lateEntryPolicy:DAILY_INPUT_GUARD_V1.lateEntryPolicy,enabled:getDailyInputPolicyV1().enabled,
    measures:c.measures.map(key=>({key,label:dailyMeasureLabelV1_(key)}))};
}
function dailyMeasureLabelV1_(key){
  const labels={bvk:'BVK',voa:'VOA',itk:'ITK',itk_peralihan:'ITK Peralihan',itas:'ITAS',itap:'ITAP',itkt:'ITKT',
    alih_status_itk_ke_itas:'Alih Status ITK ke ITAS',alih_status_itas_ke_itap:'Alih Status ITAS ke ITAP',
    abg:'ABG',epo:'EPO',imk:'IMK',skim:'SKIM',biasa_24:'Paspor Biasa 24',biasa_48:'Paspor Biasa 48',
    elektronik_48:'Paspor Elektronik 48',e_polikarbonat:'Paspor Elektronik Polikarbonat'};
  return labels[key]||key;
}
function validateDailyInputPayloadV1(payload){
  const input=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload:{};
  const allowed=['submissionId','serviceFamily','operationalDate','officeKey','contractVersion','measures','lateEntryReason'];
  const family=String(input.serviceFamily||'').trim().toUpperCase(),contract=Object.prototype.hasOwnProperty.call(DAILY_SERVICE_CONTRACTS_V1,family)?DAILY_SERVICE_CONTRACTS_V1[family]:null;
  const errors=Object.create(null),add=(k,m)=>{if(!Object.prototype.hasOwnProperty.call(errors,k))errors[k]=m;};
  Object.keys(input).forEach(k=>{if(!allowed.includes(k))add(k,'Field tidak diizinkan pada kontrak input harian ini.');});
  allowed.forEach(k=>{if(k in input&&!Object.prototype.hasOwnProperty.call(input,k))add(k,'Field kontrak harus menjadi properti langsung payload.');});
  if(!contract)add('serviceFamily','Pilih keluarga layanan yang valid.');
  const date=String(input.operationalDate||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))add('operationalDate','Tanggal harus berformat YYYY-MM-DD.');
  else{const d=new Date(date+'T00:00:00.000Z');if(Number(date.slice(0,4))<1||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)add('operationalDate','Tanggal tidak valid.');}
  const officeKey=typeof input.officeKey==='string'?input.officeKey.trim():'';
  if(!officeKey||officeKey.length>128)add('officeKey','Pilih kantor VERIFIED dari referensi kantor.');
  const submissionId=String(input.submissionId||'').trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId))add('submissionId','submissionId harus UUID valid.');
  if(contract&&String(input.contractVersion||'').trim()!==contract.version)add('contractVersion','Versi kontrak berubah; muat ulang kontrak.');
  if(Object.prototype.hasOwnProperty.call(input,'total'))add('total','Total dihitung server dan tidak boleh dikirim klien.');
  const mi=input.measures&&typeof input.measures==='object'&&!Array.isArray(input.measures)?input.measures:{},normalized={};
  if(contract){
    Object.keys(mi).forEach(k=>{if(!contract.measures.includes(k))add('measures.'+k,'Field tidak diizinkan pada kontrak layanan ini.');});
    contract.measures.forEach(k=>{
      if(!Object.prototype.hasOwnProperty.call(mi,k)){add('measures.'+k,'Nilai wajib diisi; masukkan 0 bila memang nihil.');return;}
      const v=mi[k];if(v===null||v===undefined||String(v).trim()===''){add('measures.'+k,'Nilai wajib diisi; masukkan 0 bila memang nihil.');return;}
      if(!(typeof v==='number'||typeof v==='string')||!/^\d+$/.test(String(v).trim())){add('measures.'+k,'Nilai harus bilangan bulat non-negatif.');return;}
      const n=Number(v);if(!Number.isSafeInteger(n)||n<0){add('measures.'+k,'Nilai harus bilangan bulat non-negatif yang aman.');return;}normalized[k]=n;
    });
  }
  let total=null;if(contract&&contract.measures.every(k=>Object.prototype.hasOwnProperty.call(normalized,k))){total=contract.measures.reduce((s,k)=>s+normalized[k],0);if(!Number.isSafeInteger(total)){add('measures','Total melampaui batas integer aman.');total=null;}}
  const ok=Object.keys(errors).length===0;
  return {ok,code:ok?'DAILY_INPUT_VALIDATION_OK':'DAILY_INPUT_VALIDATION_FAILED',errors,
    normalized:ok?{submissionId,serviceFamily:family,operationalDate:date,officeKey,contractVersion:contract.version,measures:normalized,total,lateEntryReason:String(input.lateEntryReason||'').trim()}:null};
}
function ensureDailyInputSheet_(){
  assertDailyInputEnabled_();
  const ss=getDailyStagingDb_();let sh=ss.getSheetByName('DAILY_INPUT_LEDGER');
  if(!sh){sh=ss.insertSheet('DAILY_INPUT_LEDGER');sh.getRange(1,1,1,DAILY_INPUT_HEADERS_V1.length).setValues([DAILY_INPUT_HEADERS_V1.slice()]);}
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  if(h.join('|')!==DAILY_INPUT_HEADERS_V1.join('|'))throw new Error('DAILY_INPUT_SCHEMA_MISMATCH');
  sh.setFrozenRows(1);return sh;
}
function dailyHeaderIndex_(sh){return Object.fromEntries(sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map((x,i)=>[String(x),i]));}
function dailyRows_(sh){
  const v=sh.getDataRange().getValues();if(v.length<2)return [];
  const h=v[0].map(String),i=Object.fromEntries(h.map((x,n)=>[x,n]));
  return v.slice(1).map((r,n)=>({row:n+2,recordId:String(r[i.record_id]||''),submissionId:String(r[i.submission_id]||''),
    serviceFamily:String(r[i.service_family]||''),operationalDate:String(r[i.operational_date]||''),officeKey:String(r[i.office_key]||''),
    officeName:String(r[i.office_name]||''),contractVersion:String(r[i.contract_version]||''),revision:Number(r[i.revision]||1),
    status:String(r[i.status]||''),measuresJson:String(r[i.measures_json]||'{}'),total:r[i.total]===undefined||r[i.total]===null||r[i.total]===''?null:Number(r[i.total]),
    sourceRecordId:String(r[i.source_record_id]||''),sourceSubmissionId:String(r[i.source_submission_id]||''),
    createdBy:String(r[i.created_by]||''),createdAt:String(r[i.created_at]||''),updatedBy:String(r[i.updated_by]||''),
    updatedAt:String(r[i.updated_at]||''),submittedBy:String(r[i.submitted_by]||''),submittedAt:String(r[i.submitted_at]||''),
    reviewedBy:String(r[i.reviewed_by]||''),reviewedAt:String(r[i.reviewed_at]||''),decisionReason:String(r[i.decision_reason]||''),
    correctionReason:String(r[i.correction_reason]||''),payloadHash:String(r[i.payload_hash]||''),lateEntryReason:String(r[i.late_entry_reason]||'')}));
}
function dailyOffice_(officeKey){
  const sh=getDb_().getSheetByName('OFFICE_REFERENCE');if(!sh||sh.getLastRow()<2)throw new Error('OFFICE_REFERENCE_NOT_READY');
  const v=sh.getDataRange().getValues(),h=v[0].map(String),i=Object.fromEntries(h.map((x,n)=>[x,n]));
  if(!['office_key','kantor_imigrasi','status'].every(k=>i[k]!==undefined))throw new Error('OFFICE_REFERENCE_SCHEMA_MISMATCH');
  const matches=v.slice(1).filter(r=>String(r[i.office_key]||'').trim()===officeKey);
  if(matches.length!==1||String(matches[0][i.status]||'').trim().toUpperCase()!=='VERIFIED')throw new Error('DAILY_OFFICE_NOT_VERIFIED');
  return {key:officeKey,name:String(matches[0][i.kantor_imigrasi]||'').trim()};
}
function listDailyInputOffices(){
  requirePermission_('daily.read');assertDailyInputEnabled_();
  const sh=getDb_().getSheetByName('OFFICE_REFERENCE');if(!sh||sh.getLastRow()<2)return [];
  const v=sh.getDataRange().getValues(),h=v[0].map(String),i=Object.fromEntries(h.map((x,n)=>[x,n]));
  if(!['office_key','kantor_imigrasi','status'].every(k=>i[k]!==undefined))throw new Error('OFFICE_REFERENCE_SCHEMA_MISMATCH');
  const seen=new Set(),out=[];
  v.slice(1).forEach(r=>{const key=String(r[i.office_key]||'').trim(),name=String(r[i.kantor_imigrasi]||'').trim();
    if(key&&name&&String(r[i.status]||'').trim().toUpperCase()==='VERIFIED'&&!seen.has(key)){seen.add(key);out.push({key,name});}});
  return out.sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
function dailyPayloadHash_(p){
  const canonical={serviceFamily:p.serviceFamily,operationalDate:p.operationalDate,officeKey:p.officeKey,contractVersion:p.contractVersion,
    measures:Object.keys(p.measures||{}).sort().reduce((o,k)=>(o[k]=p.measures[k],o),{}),lateEntryReason:String(p.lateEntryReason||'').trim()};
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(canonical),Utilities.Charset.UTF_8);
  return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');
}
function dailyRowArray_(p,office,status,revision,source,reason,user,now,hash){
  return [Utilities.getUuid(),p.submissionId,p.serviceFamily,p.operationalDate,office.key,office.name,p.contractVersion,revision,status,
    JSON.stringify(p.measures),status==='DRAFT'?'':Number(p.total),source?source.recordId:'',source?source.submissionId:'',user.email,now,user.email,now,
    status==='SUBMITTED'?user.email:'',status==='SUBMITTED'?now:'','','', '',reason||'',hash||dailyPayloadHash_(p),String(p.lateEntryReason||'')];
}
function dailyLogicalKey_(r){return [r.serviceFamily,r.operationalDate,r.officeKey].join('|');}
function dailyLatestLogical_(rows,key){return rows.filter(r=>dailyLogicalKey_(r)===key).sort((a,b)=>b.revision-a.revision||String(b.createdAt).localeCompare(String(a.createdAt)))[0]||null;}
function dailyFindByRecord_(rows,id){return rows.find(r=>r.recordId===String(id||''))||null;}
function dailyPublicRecord_(r){
  let measures={};try{measures=JSON.parse(r.measuresJson||'{}');}catch(e){}
  return {recordId:r.recordId,submissionId:r.submissionId,serviceFamily:r.serviceFamily,operationalDate:r.operationalDate,
    officeKey:r.officeKey,officeName:r.officeName,contractVersion:r.contractVersion,revision:r.revision,status:r.status,
    measures,total:r.total,sourceRecordId:r.sourceRecordId,sourceSubmissionId:r.sourceSubmissionId,createdBy:r.createdBy,
    createdAt:r.createdAt,submittedBy:r.submittedBy,submittedAt:r.submittedAt,reviewedBy:r.reviewedBy,reviewedAt:r.reviewedAt,
    decisionReason:r.decisionReason,correctionReason:r.correctionReason,lateEntryReason:r.lateEntryReason};
}
function listDailySubmissions(filters){
  const user=requirePermission_('daily.read');assertDailyInputEnabled_();
  const sh=ensureDailyInputSheet_(),p=filters||{},rows=dailyRows_(sh),status=String(p.status||'').trim().toUpperCase();
  const isSupervisor=['ADMIN','SUPERVISOR'].includes(user.role);
  const filtered=rows.filter(r=>(isSupervisor||r.createdBy===user.email)&&(!status||r.status===status))
    .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,200);
  return {ok:true,rows:filtered.map(dailyPublicRecord_),total:filtered.length};
}
function dailyValidateDraft_(payload){
  const p=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload:{};
  const family=String(p.serviceFamily||'').trim().toUpperCase(),c=DAILY_SERVICE_CONTRACTS_V1[family];
  if(!c)throw new Error('DAILY_SERVICE_FAMILY_INVALID');
  const measures=p.measures&&typeof p.measures==='object'&&!Array.isArray(p.measures)?p.measures:{},filled={};
  c.measures.forEach(k=>{const v=Object.prototype.hasOwnProperty.call(measures,k)?measures[k]:undefined;filled[k]=(v===undefined||v===null||String(v).trim()==='')?0:v;});
  const candidate=Object.assign({},p,{serviceFamily:family,measures:filled});
  const result=validateDailyInputPayloadV1(candidate);
  const errors=Object.keys(result.errors).filter(k=>!k.startsWith('measures.'));
  if(errors.length)throw new Error('DAILY_DRAFT_INVALID: '+errors.map(k=>k+' '+result.errors[k]).join('; '));
  Object.keys(measures).forEach(k=>{if(!c.measures.includes(k))throw new Error('DAILY_DRAFT_FIELD_INVALID: '+k);});
  const partial={};c.measures.forEach(k=>{const v=Object.prototype.hasOwnProperty.call(measures,k)?measures[k]:undefined;if(v!==undefined&&v!==null&&String(v).trim()!==''){const n=Number(v);if(!Number.isSafeInteger(n)||n<0||!/^\d+$/.test(String(v).trim()))throw new Error('DAILY_DRAFT_MEASURE_INVALID: '+k);partial[k]=n;}});
  return {normalized:Object.assign({},result.normalized,{measures:partial,total:null}),contract:c};
}
function assertDailyOperationalDate_(p){
  const today=Utilities.formatDate(new Date(),APP.TZ,'yyyy-MM-dd');
  if(p.operationalDate>today)throw new Error('DAILY_FUTURE_DATE_NOT_ALLOWED');
  if(p.operationalDate<today&&!String(p.lateEntryReason||'').trim())throw new Error('DAILY_LATE_ENTRY_REASON_REQUIRED');
}
function saveDailyDraft(payload){
  const user=requirePermission_('daily.draft');assertDailyInputEnabled_();
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=ensureDailyInputSheet_(),{normalized:p}=dailyValidateDraft_(payload),office=dailyOffice_(p.officeKey),rows=dailyRows_(sh),now=nowIso_();
    const existing=rows.find(r=>r.submissionId===p.submissionId);
    if(!existing){
      const latest=dailyLatestLogical_(rows,dailyLogicalKey_(p));
      if(latest){
        if(latest.status==='REJECTED')throw new Error('DAILY_CORRECTION_REQUIRED: perbaiki laporan yang ditolak melalui alur revisi.');
        if(latest.status==='VOID')throw new Error('DAILY_VOIDED_KEY_REQUIRES_REOPEN: laporan yang dibatalkan memerlukan pembukaan kembali yang diaudit.');
        throw new Error('DAILY_LOGICAL_DUPLICATE: sudah ada laporan untuk tanggal, kantor, dan keluarga layanan ini.');
      }
    }
    if(existing){
      if(existing.createdBy!==user.email||existing.status!=='DRAFT')throw new Error('DAILY_IDEMPOTENCY_CONFLICT');
      const oldHash=existing.payloadHash,newHash=dailyPayloadHash_(p);
      if(oldHash===newHash)return {ok:true,recordId:existing.recordId,status:existing.status,idempotent:true};
      const i=dailyHeaderIndex_(sh),oldRow=sh.getRange(existing.row,1,1,DAILY_INPUT_HEADERS_V1.length).getValues()[0];
      sh.getRange(existing.row,i.service_family+1,1,5).setValues([[p.serviceFamily,p.operationalDate,office.key,office.name,p.contractVersion]]);
      sh.getRange(existing.row,i.measures_json+1).setValue(JSON.stringify(p.measures));
      sh.getRange(existing.row,i.total+1).clearContent();
      sh.getRange(existing.row,i.late_entry_reason+1).setValue(p.lateEntryReason||'');
      sh.getRange(existing.row,i.updated_by+1,1,2).setValues([[user.email,now]]);
      sh.getRange(existing.row,i.payload_hash+1).setValue(newHash);
      try{dailyAppendAudit_(user,'DAILY_DRAFT_UPDATE',DAILY_SERVICE_CONTRACTS_V1[p.serviceFamily].datasetKey,p.submissionId,Object.keys(p.measures).length,'SUCCESS',JSON.stringify({operationalDate:p.operationalDate,officeKey:p.officeKey}));}
      catch(e){sh.getRange(existing.row,1,1,DAILY_INPUT_HEADERS_V1.length).setValues([oldRow]);throw new Error('DAILY_AUDIT_WRITE_FAILED: '+e.message);}
      return {ok:true,recordId:existing.recordId,status:'DRAFT',updated:true};
    }
    const rec=dailyRowArray_(p,office,'DRAFT',1,null,'',user,now,dailyPayloadHash_(p));
    sh.appendRow(rec);
    try{dailyAppendAudit_(user,'DAILY_DRAFT_CREATE',DAILY_SERVICE_CONTRACTS_V1[p.serviceFamily].datasetKey,p.submissionId,1,'SUCCESS',JSON.stringify({operationalDate:p.operationalDate,officeKey:p.officeKey}));}
    catch(e){sh.deleteRow(sh.getLastRow());throw new Error('DAILY_AUDIT_WRITE_FAILED: '+e.message);}
    return {ok:true,recordId:rec[0],status:'DRAFT'};
  }finally{lock.releaseLock();}
}
function submitDailyInput(payload){
  const user=requirePermission_('daily.submit');assertDailyInputEnabled_();
  const result=validateDailyInputPayloadV1(payload);if(!result.ok)throw new Error('DAILY_INPUT_INVALID: '+JSON.stringify(result.errors));
  const p=result.normalized;assertDailyOperationalDate_(p);const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=ensureDailyInputSheet_(),office=dailyOffice_(p.officeKey),rows=dailyRows_(sh),hash=dailyPayloadHash_(p),existing=rows.find(r=>r.submissionId===p.submissionId),key=dailyLogicalKey_({serviceFamily:p.serviceFamily,operationalDate:p.operationalDate,officeKey:p.officeKey}),latest=dailyLatestLogical_(rows,key),now=nowIso_();
    if(existing&&existing.status!=='DRAFT'){if(existing.payloadHash===hash)return {ok:true,recordId:existing.recordId,status:existing.status,idempotent:true};throw new Error('DAILY_IDEMPOTENCY_CONFLICT');}
    if(latest&&(!existing||latest.recordId!==existing.recordId)){
      if(latest.status==='REJECTED')throw new Error('DAILY_CORRECTION_REQUIRED: perbaiki laporan yang ditolak melalui alur revisi.');
      if(latest.status==='VOID')throw new Error('DAILY_VOIDED_KEY_REQUIRES_REOPEN: laporan yang dibatalkan memerlukan pembukaan kembali yang diaudit.');
      throw new Error('DAILY_LOGICAL_DUPLICATE: gunakan alur koreksi/revisi yang beralasan.');
    }
    if(existing){
      if(existing.createdBy!==user.email)throw new Error('DAILY_DRAFT_NOT_OWNER');
      const i=dailyHeaderIndex_(sh),oldStatus=existing.status,oldRow=sh.getRange(existing.row,1,1,DAILY_INPUT_HEADERS_V1.length).getValues()[0];
      sh.getRange(existing.row,i.service_family+1,1,8).setValues([[p.serviceFamily,p.operationalDate,office.key,office.name,p.contractVersion,existing.revision,'SUBMITTED',JSON.stringify(p.measures)]]);
      sh.getRange(existing.row,i.total+1).setValue(p.total);
      sh.getRange(existing.row,i.updated_by+1,1,2).setValues([[user.email,now]]);
      sh.getRange(existing.row,i.submitted_by+1,1,2).setValues([[user.email,now]]);
      sh.getRange(existing.row,i.payload_hash+1).setValue(hash);
      try{dailyAppendAudit_(user,'DAILY_SUBMIT',DAILY_SERVICE_CONTRACTS_V1[p.serviceFamily].datasetKey,p.submissionId,1,'SUCCESS',JSON.stringify({operationalDate:p.operationalDate,officeKey:p.officeKey,total:p.total,from:oldStatus}));}
      catch(e){sh.getRange(existing.row,1,1,DAILY_INPUT_HEADERS_V1.length).setValues([oldRow]);throw new Error('DAILY_AUDIT_WRITE_FAILED: '+e.message);}
      return {ok:true,recordId:existing.recordId,status:'SUBMITTED',total:p.total};
    }
    const nextRevision=latest?latest.revision+1:1,source=(latest&&(latest.status==='VOID'||latest.status==='REJECTED'))?latest:null;
    const rec=dailyRowArray_(p,office,'SUBMITTED',nextRevision,source,'',user,now,hash);sh.appendRow(rec);
    try{dailyAppendAudit_(user,'DAILY_SUBMIT',DAILY_SERVICE_CONTRACTS_V1[p.serviceFamily].datasetKey,p.submissionId,1,'SUCCESS',JSON.stringify({operationalDate:p.operationalDate,officeKey:p.officeKey,total:p.total}));}
    catch(e){sh.deleteRow(sh.getLastRow());throw new Error('DAILY_AUDIT_WRITE_FAILED: '+e.message);}
    return {ok:true,recordId:rec[0],status:'SUBMITTED',total:p.total};
  }finally{lock.releaseLock();}
}
function reviewDailySubmission(recordId,decision,reason){
  const user=requirePermission_('daily.review');assertDailyInputEnabled_();
  const action=String(decision||'').trim().toUpperCase(),why=String(reason||'').trim();
  if(!['APPROVE','REJECT'].includes(action))throw new Error('DAILY_REVIEW_DECISION_INVALID');
  if(!why&&action==='REJECT')throw new Error('DAILY_REJECTION_REASON_REQUIRED');
  if(action==='APPROVE'&&!user.permissions.includes('daily.approve'))throw new Error('FORBIDDEN: daily.approve');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=ensureDailyInputSheet_(),rows=dailyRows_(sh),r=dailyFindByRecord_(rows,recordId),next=action==='APPROVE'?'APPROVED':'REJECTED';
    if(r&&r.status===next&&r.reviewedBy===user.email&&r.decisionReason===why)return {ok:true,recordId:r.recordId,status:next,idempotent:true};
    if(!r||r.status!=='SUBMITTED')throw new Error('DAILY_SUBMISSION_NOT_REVIEWABLE');
    if(r.submittedBy===user.email)throw new Error('DAILY_SEPARATION_OF_DUTIES');
    const i=dailyHeaderIndex_(sh),now=nowIso_();
    sh.getRange(r.row,i.status+1).setValue(next);sh.getRange(r.row,i.reviewed_by+1,1,3).setValues([[user.email,now,why]]);
    try{dailyAppendAudit_(user,action==='APPROVE'?'DAILY_APPROVE':'DAILY_REJECT',DAILY_SERVICE_CONTRACTS_V1[r.serviceFamily].datasetKey,r.submissionId,1,'SUCCESS',JSON.stringify({recordId:r.recordId,reason:why}));}
    catch(e){sh.getRange(r.row,i.status+1).setValue(r.status);sh.getRange(r.row,i.reviewed_by+1,1,3).setValues([[r.reviewedBy,r.reviewedAt,r.decisionReason]]);throw new Error('DAILY_AUDIT_WRITE_FAILED: '+e.message);}
    return {ok:true,recordId:r.recordId,status:next};
  }finally{lock.releaseLock();}
}
function correctDailySubmission(recordId,payload,reason){
  const user=requirePermission_('daily.correct');assertDailyInputEnabled_();
  const why=String(reason||'').trim();if(!why)throw new Error('DAILY_CORRECTION_REASON_REQUIRED');
  const result=validateDailyInputPayloadV1(payload);if(!result.ok)throw new Error('DAILY_INPUT_INVALID: '+JSON.stringify(result.errors));
  const p=result.normalized;assertDailyOperationalDate_(p);const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=ensureDailyInputSheet_(),rows=dailyRows_(sh),hash=dailyPayloadHash_(p),prior=rows.find(r=>r.submissionId===p.submissionId);
    if(prior){
      if(prior.sourceRecordId===String(recordId)&&prior.payloadHash===hash&&prior.correctionReason===why&&['SUBMITTED','APPROVED','REJECTED'].includes(prior.status))
        return {ok:true,recordId:prior.recordId,sourceRecordId:prior.sourceRecordId,revision:prior.revision,status:prior.status,idempotent:true};
      throw new Error('DAILY_IDEMPOTENCY_CONFLICT');
    }
    const source=dailyFindByRecord_(rows,recordId);
    if(!source)throw new Error('DAILY_CORRECTION_SOURCE_NOT_FOUND');
    const canCorrectApproved=['ADMIN','SUPERVISOR'].includes(user.role)&&source.status==='APPROVED';
    const canCorrectOwnRejected=source.status==='REJECTED'&&(source.createdBy===user.email||['ADMIN','SUPERVISOR'].includes(user.role));
    if(!canCorrectApproved&&!canCorrectOwnRejected)throw new Error('DAILY_CORRECTION_SOURCE_NOT_ELIGIBLE');
    if(source.serviceFamily!==p.serviceFamily||source.operationalDate!==p.operationalDate||source.officeKey!==p.officeKey)throw new Error('DAILY_CORRECTION_CANNOT_CHANGE_LOGICAL_KEY');
    const latest=dailyLatestLogical_(rows,dailyLogicalKey_(source));if(!latest||latest.recordId!==source.recordId)throw new Error('DAILY_CORRECTION_SOURCE_NOT_LATEST');
    const office=dailyOffice_(p.officeKey),now=nowIso_(),revision=source.revision+1,rec=dailyRowArray_(p,office,'SUBMITTED',revision,source,why,user,now,hash);
    rec[22]=why;sh.appendRow(rec);
    try{dailyAppendAudit_(user,'DAILY_CORRECTION_SUBMIT',DAILY_SERVICE_CONTRACTS_V1[p.serviceFamily].datasetKey,p.submissionId,1,'SUCCESS',JSON.stringify({sourceRecordId:source.recordId,revision,reason:why,total:p.total}));}
    catch(e){sh.deleteRow(sh.getLastRow());throw new Error('DAILY_AUDIT_WRITE_FAILED: '+e.message);}
    return {ok:true,recordId:rec[0],sourceRecordId:source.recordId,revision,status:'SUBMITTED'};
  }finally{lock.releaseLock();}
}
function voidDailySubmission(recordId,reason){
  const user=requirePermission_('daily.void');assertDailyInputEnabled_();
  const why=String(reason||'').trim();if(!why)throw new Error('DAILY_VOID_REASON_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=ensureDailyInputSheet_(),rows=dailyRows_(sh),source=dailyFindByRecord_(rows,recordId);
    if(!source)throw new Error('DAILY_VOID_SOURCE_INVALID');
    const latest=dailyLatestLogical_(rows,dailyLogicalKey_(source));
    if(latest&&latest.status==='VOID'&&latest.sourceRecordId===source.recordId&&latest.decisionReason===why)
      return {ok:true,recordId:latest.recordId,sourceRecordId:source.recordId,status:'VOID',revision:latest.revision,idempotent:true};
    if(source.status!=='APPROVED')throw new Error('DAILY_VOID_SOURCE_INVALID');
    if(!latest||latest.recordId!==source.recordId)throw new Error('DAILY_VOID_SOURCE_NOT_LATEST');
    const userNow=nowIso_(),contract=DAILY_SERVICE_CONTRACTS_V1[source.serviceFamily],measures=JSON.parse(source.measuresJson||'{}');
    const p={submissionId:Utilities.getUuid(),serviceFamily:source.serviceFamily,operationalDate:source.operationalDate,officeKey:source.officeKey,contractVersion:source.contractVersion,measures,total:source.total,lateEntryReason:source.lateEntryReason};
    const office=dailyOffice_(p.officeKey),rec=dailyRowArray_(p,office,'VOID',source.revision+1,source,why,user,userNow,dailyPayloadHash_(p));
    rec[21]=why;sh.appendRow(rec);
    try{dailyAppendAudit_(user,'DAILY_VOID',contract.datasetKey,p.submissionId,1,'SUCCESS',JSON.stringify({sourceRecordId:source.recordId,reason:why,revision:source.revision+1}));}
    catch(e){sh.deleteRow(sh.getLastRow());throw new Error('DAILY_AUDIT_WRITE_FAILED: '+e.message);}
    return {ok:true,recordId:rec[0],sourceRecordId:source.recordId,status:'VOID',revision:source.revision+1};
  }finally{lock.releaseLock();}
}
