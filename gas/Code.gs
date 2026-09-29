function doGet(){return HtmlService.createTemplateFromFile('index').evaluate().setTitle(APP.NAME).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);}
function setupApp(spreadsheetId){
  const id=String(spreadsheetId||'').trim();
  const ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('Spreadsheet ID wajib diisi saat project Apps Script bersifat standalone.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',ss.getId());
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
    AUDIT_LOG:['event_id','timestamp','actor','action','dataset_key','batch_id','affected_rows','status','details']
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
    ['total','Total','TOTAL','INTEGER','FALSE','','derived_integer','INTERNAL','TRUE','TRUE','','1']
  ];
  const existing=sh.getDataRange().getValues(),byKey={};
  for(let r=1;r<existing.length;r++)byKey[String(existing[r][idx.canonical_key]||'')]=r+1;
  rows.forEach(row=>{const key=row[0],target=byKey[key];if(target)sh.getRange(target,1,1,row.length).setValues([row]);else sh.appendRow(row);});
}
function getBootstrap(){const u=getCurrentUser_();return {app:{name:APP.NAME,version:APP.VERSION,timezone:APP.TZ},user:u,permissions:u.permissions};}
