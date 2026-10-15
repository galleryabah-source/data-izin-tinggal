/**
 * Phase 9 — governed daily service input, isolated from monthly datasets.
 * Daily rows are stored only in DAILY_INPUT_RECORDS. No importer, registry,
 * monthly source sheet, or historical monthly row is written by this module.
 */
const DAILY_INPUT_STORE_V1 = Object.freeze({
  sheet: 'DAILY_INPUT_RECORDS',
  version: 'v1',
  headers: [
    'record_id','logical_key','revision','previous_record_id','submission_id',
    'service_family','operational_date','office_key','measures_json','total',
    'status','payload_hash','created_by','created_at','submitted_by','submitted_at',
    'reviewed_by','reviewed_at','review_reason','correction_reason','voided_by',
    'voided_at','contract_version','late_entry_reason','updated_at'
  ]
});

function dailyInputEnabled_() {
  const sh = getDb_().getSheetByName(SHEETS.CONFIG);
  const rows = sh ? sh.getDataRange().getValues().slice(1) : [];
  const row = rows.find(r => String(r[0] || '').trim() === DAILY_INPUT_GUARD_V1.featureFlagKey);
  // The application-level guard is authoritative; CONFIG can turn the feature off.
  return DAILY_INPUT_GUARD_V1.enabled && (!row || String(row[1] || '').trim().toLowerCase() !== 'false');
}
function assertDailyInputEnabled_() {
  if (!dailyInputEnabled_()) throw new Error('DAILY_INPUT_DISABLED');
}
function requireDailyAction_(action) {
  const permissionByAction = {
    read: 'dataset.read', draft: 'dataset.write', submit: 'dataset.write',
    review: 'dataset.approve', correct: 'dataset.approve', void: 'dataset.approve'
  };
  const permission = permissionByAction[action];
  if (!permission) throw new Error('DAILY_INPUT_ACTION_INVALID');
  return requirePermission_(permission);
}
function ensureDailyInputStore_() {
  const ss = getDb_();
  let sh = ss.getSheetByName(DAILY_INPUT_STORE_V1.sheet);
  if (!sh) {
    sh = ss.insertSheet(DAILY_INPUT_STORE_V1.sheet);
    sh.getRange(1, 1, 1, DAILY_INPUT_STORE_V1.headers.length).setValues([DAILY_INPUT_STORE_V1.headers]);
    sh.setFrozenRows(1);
  } else {
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v || '').trim());
    if (headers.join('|') !== DAILY_INPUT_STORE_V1.headers.join('|')) throw new Error('DAILY_INPUT_SCHEMA_MISMATCH');
  }
  return sh;
}
function dailyRows_() {
  const sh = ensureDailyInputStore_(), values = sh.getDataRange().getValues();
  if (values.length < 2) return {sh, headers: values[0] || DAILY_INPUT_STORE_V1.headers, rows: []};
  const headers = values[0].map(v => String(v || '').trim()), i = Object.fromEntries(headers.map((v,n) => [v,n]));
  const rows = values.slice(1).map((r,n) => ({rowNumber:n+2, values:r, index:i})).filter(x => String(x.values[i.record_id] || '').trim());
  return {sh, headers, rows};
}
function dailyRecordFromRow_(entry) {
  const r=entry.values,i=entry.index;
  let measures={}; try { measures=JSON.parse(String(r[i.measures_json]||'{}')); } catch(e) {}
  return {
    recordId:String(r[i.record_id]||''), logicalKey:String(r[i.logical_key]||''),
    revision:Number(r[i.revision]||1), previousRecordId:String(r[i.previous_record_id]||''),
    submissionId:String(r[i.submission_id]||''), serviceFamily:String(r[i.service_family]||''),
    operationalDate:String(r[i.operational_date]||''), officeKey:String(r[i.office_key]||''),
    measures,total:Number(r[i.total]||0),status:String(r[i.status]||'').toUpperCase(),
    createdBy:String(r[i.created_by]||''),createdAt:String(r[i.created_at]||''),
    submittedBy:String(r[i.submitted_by]||''),submittedAt:String(r[i.submitted_at]||''),
    reviewedBy:String(r[i.reviewed_by]||''),reviewedAt:String(r[i.reviewed_at]||''),
    reviewReason:String(r[i.review_reason]||''),correctionReason:String(r[i.correction_reason]||''),
    lateEntryReason:String(r[i.late_entry_reason]||''),contractVersion:String(r[i.contract_version]||''),
    updatedAt:String(r[i.updated_at]||'')
  };
}
function dailyHash_(value) {
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value),Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}
function dailyLogicalKey_(family,date,officeKey) { return [family,date,officeKey].join('|'); }
function findVerifiedDailyOffice_(officeKey) {
  const sh=getDb_().getSheetByName('OFFICE_REFERENCE');
  if(!sh||sh.getLastRow()<2)throw new Error('OFFICE_REFERENCE_NOT_READY');
  const values=sh.getDataRange().getValues(),h=values[0].map(v=>String(v||'').trim()),i=Object.fromEntries(h.map((v,n)=>[v,n]));
  ['office_key','kantor_imigrasi','status'].forEach(k=>{if(i[k]===undefined)throw new Error('OFFICE_REFERENCE_SCHEMA_MISMATCH');});
  const matches=values.slice(1).filter(r=>String(r[i.office_key]||'').trim()===officeKey);
  if(matches.length!==1)throw new Error(matches.length?'OFFICE_REFERENCE_DUPLICATE_KEY':'OFFICE_REFERENCE_UNKNOWN_KEY');
  if(String(matches[0][i.status]||'').trim().toUpperCase()!=='VERIFIED')throw new Error('OFFICE_REFERENCE_NOT_VERIFIED');
  return {officeKey,officeName:String(matches[0][i.kantor_imigrasi]||'').trim()};
}
function listDailyInputOfficesV1() {
  requireDailyAction_('read');
  const sh=getDb_().getSheetByName('OFFICE_REFERENCE');
  if(!sh||sh.getLastRow()<2)return [];
  const v=sh.getDataRange().getValues(),h=v[0].map(x=>String(x||'').trim()),i=Object.fromEntries(h.map((x,n)=>[x,n]));
  if(i.office_key===undefined||i.kantor_imigrasi===undefined||i.status===undefined)throw new Error('OFFICE_REFERENCE_SCHEMA_MISMATCH');
  const seen=new Set();
  return v.slice(1).filter(r=>String(r[i.status]||'').toUpperCase()==='VERIFIED').map(r=>({
    officeKey:String(r[i.office_key]||'').trim(),officeName:String(r[i.kantor_imigrasi]||'').trim()
  })).filter(o=>o.officeKey&&o.officeName&&!seen.has(o.officeKey)&&seen.add(o.officeKey)).sort((a,b)=>a.officeName.localeCompare(b.officeName,'id'));
}
function listDailyInputRecordsV1(filters) {
  requireDailyAction_('read');
  const f=filters||{},family=String(f.serviceFamily||'').trim().toUpperCase(),status=String(f.status||'').trim().toUpperCase();
  const {rows}=dailyRows_();
  return rows.map(dailyRecordFromRow_).filter(r=>
    (!family||r.serviceFamily===family)&&(!status||r.status===status)&&
    (!f.operationalDate||r.operationalDate===String(f.operationalDate))&&
    (!f.officeKey||r.officeKey===String(f.officeKey))
  ).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,250);
}
function saveDailyInputDraftV1(payload, lateEntryReason) {
  assertDailyInputEnabled_();
  const user=requireDailyAction_('draft'),p=payload||{};
  const checked=validateDailyInputPayloadV1(p);
  if(!checked.ok)throw new Error('DAILY_INPUT_VALIDATION_FAILED: '+JSON.stringify(checked.errors));
  const normalized=checked.normalized,office=findVerifiedDailyOffice_(normalized.officeKey);
  const today=Utilities.formatDate(new Date(),APP.TZ,'yyyy-MM-dd');
  const lateReason=String(lateEntryReason||'').trim();
  if(normalized.operationalDate<today&&!lateReason)throw new Error('LATE_ENTRY_REASON_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const data=dailyRows_(),existing=data.rows.find(x=>String(x.values[x.index.submission_id]||'')===normalized.submissionId);
    const hash=dailyHash_(normalized),now=nowIso_();
    if(existing) {
      const record=dailyRecordFromRow_(existing);
      if(record.status!=='DRAFT') {
        if(String(existing.values[existing.index.payload_hash]||'')===hash)return {ok:true,recordId:record.recordId,status:record.status,idempotent:true};
        throw new Error('DAILY_INPUT_IDEMPOTENCY_CONFLICT');
      }
      const row=existing.values.slice();
      row[existing.index.measures_json]=JSON.stringify(normalized.measures);row[existing.index.total]=normalized.total;
      row[existing.index.payload_hash]=hash;row[existing.index.late_entry_reason]=lateReason;row[existing.index.updated_at]=now;
      data.sh.getRange(existing.rowNumber,1,1,row.length).setValues([row]);
      appendAudit_('DAILY_INPUT_DRAFT_SAVE',normalized.serviceFamily,record.recordId,1,'SUCCESS',JSON.stringify({operationalDate:normalized.operationalDate,officeKey:normalized.officeKey,total:normalized.total}));
      return {ok:true,recordId:record.recordId,status:'DRAFT',updated:true};
    }
    const logicalKey=dailyLogicalKey_(normalized.serviceFamily,normalized.operationalDate,normalized.officeKey);
    const blocking=data.rows.map(dailyRecordFromRow_).find(r=>r.logicalKey===logicalKey&&['SUBMITTED','APPROVED'].includes(r.status));
    if(blocking)throw new Error('DAILY_INPUT_LOGICAL_CONFLICT: gunakan alur koreksi untuk laporan yang sudah diajukan/disetujui.');
    const recordId=Utilities.getUuid();
    const row=[recordId,logicalKey,1,'',normalized.submissionId,normalized.serviceFamily,normalized.operationalDate,normalized.officeKey,JSON.stringify(normalized.measures),normalized.total,'DRAFT',hash,user.email,now,'','','','','','', '', '',normalized.contractVersion,lateReason,now];
    data.sh.appendRow(row);
    appendAudit_('DAILY_INPUT_DRAFT_SAVE',normalized.serviceFamily,recordId,1,'SUCCESS',JSON.stringify({operationalDate:normalized.operationalDate,officeKey:normalized.officeKey,officeName:office.officeName,total:normalized.total}));
    return {ok:true,recordId,status:'DRAFT'};
  } finally { lock.releaseLock(); }
}
function submitDailyInputV1(payload, lateEntryReason) {
  assertDailyInputEnabled_();
  const user=requireDailyAction_('submit'),p=payload||{},checked=validateDailyInputPayloadV1(p);
  if(!checked.ok)throw new Error('DAILY_INPUT_VALIDATION_FAILED: '+JSON.stringify(checked.errors));
  const n=checked.normalized,office=findVerifiedDailyOffice_(n.officeKey),today=Utilities.formatDate(new Date(),APP.TZ,'yyyy-MM-dd'),lateReason=String(lateEntryReason||'').trim();
  if(n.operationalDate<today&&!lateReason)throw new Error('LATE_ENTRY_REASON_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const data=dailyRows_(),hash=dailyHash_(n),prior=data.rows.find(x=>String(x.values[x.index.submission_id]||'')===n.submissionId);
    if(prior) {
      const record=dailyRecordFromRow_(prior),oldHash=String(prior.values[prior.index.payload_hash]||'');
      if(oldHash!==hash)throw new Error('DAILY_INPUT_IDEMPOTENCY_CONFLICT');
      if(record.status==='DRAFT') {
        const i=prior.index,row=prior.values.slice(),now=nowIso_();
        row[i.status]='SUBMITTED';row[i.submitted_by]=user.email;row[i.submitted_at]=now;row[i.late_entry_reason]=lateReason;row[i.updated_at]=now;
        data.sh.getRange(prior.rowNumber,1,1,row.length).setValues([row]);
        appendAudit_('DAILY_INPUT_SUBMIT',n.serviceFamily,record.recordId,1,'SUCCESS',JSON.stringify({revision:record.revision,total:n.total,lateEntry:!!lateReason}));
        return {ok:true,recordId:record.recordId,status:'SUBMITTED',idempotent:false};
      }
      return {ok:true,recordId:record.recordId,status:record.status,idempotent:true};
    }
    const logicalKey=dailyLogicalKey_(n.serviceFamily,n.operationalDate,n.officeKey);
    const blocking=data.rows.map(dailyRecordFromRow_).find(r=>r.logicalKey===logicalKey&&['SUBMITTED','APPROVED'].includes(r.status));
    if(blocking)throw new Error('DAILY_INPUT_LOGICAL_CONFLICT: gunakan alur koreksi.');
    const now=nowIso_(),id=Utilities.getUuid(),row=[id,logicalKey,1,'',n.submissionId,n.serviceFamily,n.operationalDate,n.officeKey,JSON.stringify(n.measures),n.total,'SUBMITTED',hash,user.email,now,user.email,now,'','','','','','',n.contractVersion,lateReason,now];
    data.sh.appendRow(row);
    appendAudit_('DAILY_INPUT_SUBMIT',n.serviceFamily,id,1,'SUCCESS',JSON.stringify({operationalDate:n.operationalDate,officeKey:n.officeKey,officeName:office.officeName,total:n.total,lateEntry:!!lateReason}));
    return {ok:true,recordId:id,status:'SUBMITTED'};
  } finally { lock.releaseLock(); }
}
function reviewDailyInputV1(recordId, decision, reason) {
  assertDailyInputEnabled_();
  const user=requireDailyAction_('review'),id=String(recordId||'').trim(),action=String(decision||'').trim().toUpperCase(),why=String(reason||'').trim();
  if(!id||!['APPROVE','RETURN'].includes(action))throw new Error('DAILY_INPUT_REVIEW_INVALID');
  if(action==='RETURN'&&!why)throw new Error('DAILY_INPUT_RETURN_REASON_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const data=dailyRows_(),entry=data.rows.find(x=>String(x.values[x.index.record_id]||'')===id);
    if(!entry)throw new Error('DAILY_INPUT_RECORD_NOT_FOUND');
    const record=dailyRecordFromRow_(entry);
    if(record.status!=='SUBMITTED')throw new Error('DAILY_INPUT_NOT_SUBMITTED');
    if(action==='APPROVE'&&record.submittedBy.toLowerCase()===user.email.toLowerCase())throw new Error('DAILY_INPUT_SELF_APPROVAL_DENIED');
    const i=entry.index,row=entry.values.slice(),now=nowIso_();
    row[i.status]=action==='APPROVE'?'APPROVED':'RETURNED';row[i.reviewed_by]=user.email;row[i.reviewed_at]=now;row[i.review_reason]=why;row[i.updated_at]=now;
    data.sh.getRange(entry.rowNumber,1,1,row.length).setValues([row]);
    appendAudit_(action==='APPROVE'?'DAILY_INPUT_APPROVE':'DAILY_INPUT_RETURN',record.serviceFamily,id,1,'SUCCESS',JSON.stringify({revision:record.revision,reason:why,total:record.total}));
    return {ok:true,recordId:id,status:row[i.status]};
  } finally {lock.releaseLock();}
}
function correctDailyInputV1(recordId, payload, reason, lateEntryReason) {
  assertDailyInputEnabled_();
  const user=requireDailyAction_('correct'),id=String(recordId||'').trim(),why=String(reason||'').trim();
  if(!id||!why)throw new Error('DAILY_INPUT_CORRECTION_REASON_REQUIRED');
  const checked=validateDailyInputPayloadV1(payload||{});
  if(!checked.ok)throw new Error('DAILY_INPUT_VALIDATION_FAILED: '+JSON.stringify(checked.errors));
  const n=checked.normalized,office=findVerifiedDailyOffice_(n.officeKey),late=String(lateEntryReason||'').trim(),today=Utilities.formatDate(new Date(),APP.TZ,'yyyy-MM-dd');
  if(n.operationalDate<today&&!late)throw new Error('LATE_ENTRY_REASON_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const data=dailyRows_(),entry=data.rows.find(x=>String(x.values[x.index.record_id]||'')===id);
    if(!entry)throw new Error('DAILY_INPUT_RECORD_NOT_FOUND');
    const previous=dailyRecordFromRow_(entry);
    if(!['APPROVED','SUBMITTED','RETURNED'].includes(previous.status))throw new Error('DAILY_INPUT_CORRECTION_STATE_INVALID');
    if(previous.serviceFamily!==n.serviceFamily||previous.operationalDate!==n.operationalDate||previous.officeKey!==n.officeKey)throw new Error('DAILY_INPUT_CORRECTION_KEY_IMMUTABLE');
    const revision=1+Math.max(...data.rows.map(x=>dailyRecordFromRow_(x)).filter(r=>r.logicalKey===previous.logicalKey).map(r=>r.revision),0);
    const recordIdNew=Utilities.getUuid(),now=nowIso_(),hash=dailyHash_(n);
    const row=[recordIdNew,previous.logicalKey,revision,previous.recordId,n.submissionId,n.serviceFamily,n.operationalDate,n.officeKey,JSON.stringify(n.measures),n.total,'SUBMITTED',hash,user.email,now,user.email,now,'','', '',why,'','','',n.contractVersion,late,now];
    data.sh.appendRow(row);
    const oi=entry.index,old=entry.values.slice();old[oi.status]='SUPERSEDED';old[oi.updated_at]=now;
    data.sh.getRange(entry.rowNumber,1,1,old.length).setValues([old]);
    appendAudit_('DAILY_INPUT_CORRECTION',n.serviceFamily,recordIdNew,1,'SUCCESS',JSON.stringify({previousRecordId:previous.recordId,revision,reason:why,total:n.total,officeName:office.officeName}));
    return {ok:true,recordId:recordIdNew,previousRecordId:previous.recordId,revision,status:'SUBMITTED'};
  } finally {lock.releaseLock();}
}
function voidDailyInputV1(recordId, reason) {
  assertDailyInputEnabled_();
  const user=requireDailyAction_('void'),id=String(recordId||'').trim(),why=String(reason||'').trim();
  if(!id||!why)throw new Error('DAILY_INPUT_VOID_REASON_REQUIRED');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const data=dailyRows_(),entry=data.rows.find(x=>String(x.values[x.index.record_id]||'')===id);
    if(!entry)throw new Error('DAILY_INPUT_RECORD_NOT_FOUND');
    const record=dailyRecordFromRow_(entry);
    if(!['APPROVED','SUBMITTED','RETURNED'].includes(record.status))throw new Error('DAILY_INPUT_VOID_STATE_INVALID');
    const i=entry.index,row=entry.values.slice(),now=nowIso_();
    row[i.status]='VOID';row[i.voided_by]=user.email;row[i.voided_at]=now;row[i.correction_reason]=why;row[i.updated_at]=now;
    data.sh.getRange(entry.rowNumber,1,1,row.length).setValues([row]);
    appendAudit_('DAILY_INPUT_VOID',record.serviceFamily,id,1,'SUCCESS',JSON.stringify({reason:why,revision:record.revision,total:record.total}));
    return {ok:true,recordId:id,status:'VOID'};
  } finally {lock.releaseLock();}
}
