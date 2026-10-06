function doGet(e){const view=e&&e.parameter&&String(e.parameter.view||'').toLowerCase();if(view!=='tv')requireBackOfficeAccess_();const file=view==='tv'?'tv':'index';return HtmlService.createTemplateFromFile(file).evaluate().setTitle(view==='tv'?'INTAL TV · Command Display':APP.NAME).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);}
function setupApp(){
  const props=PropertiesService.getScriptProperties();
  const id=String(props.getProperty('SPREADSHEET_ID')||'').trim();
  const ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('SPREADSHEET_ID belum dikonfigurasi pada Script Properties.');
  props.setProperty('SPREADSHEET_ID',ss.getId());
  initializeSchema_(ss); seedSecurity_(); seedDictionary_();
  return {ok:true,spreadsheetId:ss.getId()};
}
function initializeSchema_(ss){
  const schemas={
    CONFIG:['key','value','updated_at'],USERS:['user_id','email','display_name','role','status','password_hash','salt','created_at','updated_at'],
    ROLES:['role','description','status'],PERMISSIONS:['role','permission'],
    DATA_DICTIONARY:['canonical_key','display_name','aliases','data_type','required','enum_values','transform','pii_classification','searchable','aggregatable','map_role','version'],
    DATASET_REGISTRY:['dataset_key','sheet_name','schema_signature','columns_json','row_count','status','created_at','updated_at','created_by'],
    IMPORT_LOG:['batch_id','timestamp','actor','dataset_key','schema_version','row_count','accepted','rejected','duplicates','status','error_summary'],
    AUDIT_LOG:['event_id','timestamp','actor','action','dataset_key','batch_id','affected_rows','status','details'],RUNNING_TEXTS:['content_id','content','status','priority','start_at','end_at','created_by','created_at','updated_at'],PERIOD_CLOSURES:['closure_id','dataset_key','periode','status','closed_by','closed_at','reason','reopened_by','reopened_at']
  };
  Object.keys(schemas).forEach(n=>{let sh=ss.getSheetByName(n)||ss.insertSheet(n);if(sh.getLastRow()===0)sh.getRange(1,1,1,schemas[n].length).setValues([schemas[n]]);sh.setFrozenRows(1);});
}
function seedSecurity_(){
  const ss=getDb_(), roles=ss.getSheetByName(SHEETS.ROLES), perms=ss.getSheetByName(SHEETS.PERMISSIONS);
  if(roles.getLastRow()===1)roles.getRange(2,1,5,3).setValues([
    ['ADMIN','Full system administration','ACTIVE'],['SUPERVISOR','Operational supervision','ACTIVE'],['OPERATOR','Data operations','ACTIVE'],['VIEWER','Read-only access','ACTIVE'],['AUDITOR','Audit/read-only evidence','ACTIVE']
  ]);
  if(perms.getLastRow()===1){const rows=[];Object.keys(DEFAULT_ROLES).forEach(r=>DEFAULT_ROLES[r].forEach(p=>rows.push([r,p])));perms.getRange(2,1,rows.length,2).setValues(rows);}
}
function seedDictionary_(){
  const sh=getDb_().getSheetByName(SHEETS.DATA_DICTIONARY),headers=sh.getRange(1,1,1,12).getValues()[0],idx=Object.fromEntries(headers.map((x,n)=>[x,n]));
  const rows=[
    ['no','Nomor','NO;NOMOR','TEXT','FALSE','','trim','INTERNAL','TRUE','FALSE','','1'],
    ['no_paspor','Nomor Paspor','NO PASPOR;PASPOR;PASSPORT','TEXT','FALSE','','trim','RESTRICTED','TRUE','FALSE','','1'],
    ['nama','Nama','NAMA;NAMA LENGKAP','TEXT','TRUE','','trim','RESTRICTED','TRUE','FALSE','','1'],
    ['jenis_izin_tinggal','Jenis Izin Tinggal','JENIS IZIN TINGGAL;JENIS IZIN','TEXT','TRUE','','trim','INTERNAL','TRUE','TRUE','','1'],
    ['tanggal_terbit','Tanggal Terbit','TANGGAL TERBIT;TGL TERBIT','DATE','FALSE','','date','INTERNAL','FALSE','TRUE','','1'],
    ['tanggal_berakhir','Tanggal Berakhir','TANGGAL BERAKHIR;TGL BERAKHIR','DATE','TRUE','','date','INTERNAL','TRUE','TRUE','','1'],
    ['kewarganegaraan','Kewarganegaraan','KEWARGANEGARAAN;WARGANEGARA','TEXT','FALSE','','trim','INTERNAL','TRUE','TRUE','','1'],
    ['kantor','Kantor','KANTOR;KANTOR IMIGRASI','TEXT','FALSE','','trim','INTERNAL','TRUE','TRUE','region','1'],
    ['provinsi','Provinsi','PROVINSI','TEXT','FALSE','','trim','INTERNAL','TRUE','TRUE','region','1'],
    ['kabupaten_kota','Kabupaten/Kota','KABUPATEN/KOTA;KOTA','TEXT','FALSE','','trim','INTERNAL','TRUE','TRUE','region','1'],
    ['latitude','Latitude','LATITUDE;LAT','NUMBER','FALSE','','number','INTERNAL','FALSE','TRUE','latitude','1'],
    ['longitude','Longitude','LONGITUDE;LON;LNG','NUMBER','FALSE','','number','INTERNAL','FALSE','TRUE','longitude','1'],
    ['status','Status','STATUS','TEXT','FALSE','','trim','INTERNAL','TRUE','TRUE','','1'],
    ['source','Sumber','SOURCE;SUMBER','TEXT','FALSE','','trim','INTERNAL','FALSE','FALSE','','1'],
    ['periode','Periode','PERIODE;PERIOD;BULAN','PERIOD','TRUE','','period','INTERNAL','TRUE','TRUE','','1'],
    ['kantor_imigrasi','Kantor Imigrasi','KANTOR IMIGRASI;KANTOR;UPT IMIGRASI','TEXT','TRUE','','trim','INTERNAL','TRUE','TRUE','region','1'],
    ['bvk','BVK','BVK','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['voa','VOA','VOA','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['itk','ITK','ITK','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['itk_peralihan','ITK Peralihan','ITK PERALIHAN;ITK PERALIHANAN','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['itas','ITAS','ITAS','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['itap','ITAP','ITAP','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['itkt','ITKT','ITKT','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['alih_status_itk_ke_itas','Alih Status ITK ke ITAS','ALIH STATUS ITK KE ITAS;ITK KE ITAS','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['alih_status_itas_ke_itap','Alih Status ITAS ke ITAP','ALIH STATUS ITAS KE ITAP;ITAS KE ITAP','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['abg','ABG','ABG','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['epo','EPO','EPO','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['imk','IMK','IMK','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['skim','SKIM','SKIM','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['m_paspor','M-Paspor','M-PASPOR;M PASPOR;MPASPOR','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['walk_in','Walk In','WALK IN;WALK-IN;WALKIN','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['prioritas','Prioritas','PRIORITAS','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['percepatan','Percepatan','PERCEPATAN','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['eazy','Eazy','EAZY','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['inovasi','Inovasi','INOVASI','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['bap','BAP','BAP','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['total_permohonan','Total Permohonan','JUMLAH;TOTAL PERMOHONAN','INTEGER','FALSE','','derived_integer','INTERNAL','TRUE','TRUE','','1'],
    ['penerbitan','Penerbitan','PENERBITAN;JUMLAH PENERBITAN','INTEGER','TRUE','','integer','INTERNAL','TRUE','TRUE','','1'],
    ['total','Total','TOTAL','INTEGER','FALSE','','derived_integer','INTERNAL','TRUE','TRUE','','1']
  ];
  const existing=sh.getDataRange().getValues(),byKey={};
  for(let r=1;r<existing.length;r++)byKey[String(existing[r][idx.canonical_key]||'')]=r+1;
  rows.forEach(row=>{const key=row[0],target=byKey[key];if(target)sh.getRange(target,1,1,row.length).setValues([row]);else sh.appendRow(row);});
}
function getBootstrap(){const u=requireBackOfficeAccess_();return {app:{name:APP.NAME,version:APP.VERSION,timezone:APP.TZ},user:u,permissions:u.permissions};}


function ensureRunningTextSheet_(){
  const ss=getDb_();
  let sh=ss.getSheetByName(SHEETS.RUNNING_TEXTS);
  const headers=['content_id','content','status','priority','start_at','end_at','created_by','created_at','updated_at'];
  if(!sh)sh=ss.insertSheet(SHEETS.RUNNING_TEXTS);
  if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}
function getRunningTextSheet_(){return getDb_().getSheetByName(SHEETS.RUNNING_TEXTS)||null;}
function normalizeRunningTextRow_(r,h){
  const i=Object.fromEntries(h.map((x,n)=>[x,n]));
  return {
    contentId:String(r[i.content_id]||''),
    content:String(r[i.content]||''),
    status:String(r[i.status]||'INACTIVE').toUpperCase(),
    priority:Number(r[i.priority]||0),
    startAt:String(r[i.start_at]||''),
    endAt:String(r[i.end_at]||''),
    createdBy:String(r[i.created_by]||''),
    createdAt:String(r[i.created_at]||''),
    updatedAt:String(r[i.updated_at]||'')
  };
}
function listRunningTextsAdmin(){
  requirePermission_('admin.config');
  const sh=ensureRunningTextSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2)return [];
  return v.slice(1).filter(r=>String(r[0]||'').trim()).map(r=>normalizeRunningTextRow_(r,v[0])).sort((a,b)=>a.priority-b.priority||a.content.localeCompare(b.content));
}
function saveRunningText(payload){
  requirePermission_('admin.config');
  const p=payload||{},content=String(p.content||'').trim(),status=String(p.status||'ACTIVE').toUpperCase();
  if(!content)throw new Error('Konten running text wajib diisi.');
  if(content.length>1000)throw new Error('Konten running text maksimal 1000 karakter.');
  if(!['ACTIVE','INACTIVE'].includes(status))throw new Error('Status running text tidak valid.');
  const priority=Math.max(0,Number(p.priority||0)||0),startAt=String(p.startAt||'').trim(),endAt=String(p.endAt||'').trim();
  const startMs=startAt?new Date(startAt).getTime():NaN,endMs=endAt?new Date(endAt).getTime():NaN;
  if(startAt&&!Number.isFinite(startMs))throw new Error('Waktu mulai tidak valid.');
  if(endAt&&!Number.isFinite(endMs))throw new Error('Waktu selesai tidak valid.');
  if(startAt&&endAt&&startMs>endMs)throw new Error('Waktu mulai tidak boleh melewati waktu selesai.');
  const sh=ensureRunningTextSheet_(),v=sh.getDataRange().getValues(),h=v[0],id=String(p.contentId||'').trim(),actor=getCurrentUser_().email,now=nowIso_();
  let rowIndex=-1;
  if(id){for(let r=1;r<v.length;r++)if(String(v[r][0]||'')===id){rowIndex=r+1;break;}}
  const contentId=id||Utilities.getUuid();
  const row=[contentId,content,status,priority,startAt,endAt,rowIndex>0?String(v[rowIndex-1][6]||actor):actor,rowIndex>0?String(v[rowIndex-1][7]||now):now,now];
  if(rowIndex>0)sh.getRange(rowIndex,1,1,row.length).setValues([row]);else sh.appendRow(row);
  appendAudit_('RUNNING_TEXT_SAVE','', '',1,'SUCCESS',JSON.stringify({contentId,status,priority}));
  return {ok:true,contentId};
}
function deleteRunningText(contentId){
  requirePermission_('admin.config');
  const id=String(contentId||'').trim();
  if(!id)throw new Error('contentId wajib diisi.');
  const sh=ensureRunningTextSheet_(),v=sh.getDataRange().getValues();
  for(let r=1;r<v.length;r++){
    if(String(v[r][0]||'')===id){
      sh.deleteRow(r+1);
      appendAudit_('RUNNING_TEXT_DELETE','', '',1,'SUCCESS',JSON.stringify({contentId:id}));
      return {ok:true,contentId:id};
    }
  }
  throw new Error('Konten running text tidak ditemukan.');
}
function getActiveRunningTexts(){
  requirePermission_('dashboard.read');
  return getActiveRunningTexts_();
}
function getActiveRunningTexts_(){
  const cacheKey=readCacheKey_('running-text-active');
  const cached=readCacheGet_(cacheKey);if(cached)return cached;
  const sh=getRunningTextSheet_();
  if(!sh)return [];
  const v=sh.getDataRange().getValues(),now=new Date();
  if(v.length<2)return [];
  const result=v.slice(1).filter(r=>String(r[0]||'').trim()).map(r=>normalizeRunningTextRow_(r,v[0])).filter(x=>{
    if(x.status!=='ACTIVE')return false;
    const start=x.startAt?new Date(x.startAt).getTime():NaN,end=x.endAt?new Date(x.endAt).getTime():NaN,t=now.getTime();
    return (!Number.isFinite(start)||t>=start)&&(!Number.isFinite(end)||t<=end);
  }).sort((a,b)=>a.priority-b.priority||a.content.localeCompare(b.content)).map(x=>x.content);
  return readCachePut_(cacheKey,result,10);
}
