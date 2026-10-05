const APP = Object.freeze({NAME:'Data Izin Tinggal',VERSION:'0.2.0',TZ:'Asia/Jakarta',MAX_IMPORT_ROWS:5000,MAX_CELL_CHARS:50000,SHEET_PREFIX:'DATA_',DEPLOYMENT_ID:'AKfycbzwhcpZWp8LhyidPFsvqwBQ6ZrgXjEB60NkyNmaQYsiewsvm9uZ_pwPdrG5xZINF2NK',RELEASE_EVIDENCE_VERSION:'1'});
const SHEETS = Object.freeze({CONFIG:'CONFIG',USERS:'USERS',ROLES:'ROLES',PERMISSIONS:'PERMISSIONS',DATA_DICTIONARY:'DATA_DICTIONARY',DATASET_REGISTRY:'DATASET_REGISTRY',IMPORT_LOG:'IMPORT_LOG',AUDIT_LOG:'AUDIT_LOG',RUNNING_TEXTS:'RUNNING_TEXTS',PERIOD_CLOSURES:'PERIOD_CLOSURES'});
const DEFAULT_ROLES = {
  ADMIN:['dashboard.read','dataset.read','dataset.write','dataset.import','dataset.export','dataset.approve','dataset.delete','map.read','admin.users','admin.roles','admin.config','audit.read'],
  SUPERVISOR:['dashboard.read','dataset.read','dataset.write','dataset.import','dataset.export','dataset.approve','map.read'],
  OPERATOR:['dashboard.read','dataset.read','dataset.write','dataset.import','map.read'],
  VIEWER:['dashboard.read','dataset.read','map.read'],
  AUDITOR:['dashboard.read','dataset.read','audit.read']
};
const OFFICE_REFERENCE_CONTRACT = Object.freeze({datasetKey:'OFFICE_REFERENCE',version:'1',columns:['office_key','kantor_imigrasi','address','latitude','longitude','source_url','verified_at','status'],required:['office_key','kantor_imigrasi','address','latitude','longitude','source_url','status'],optional:['verified_at'],businessKey:['office_key']});
const DATASET_CONTRACTS = Object.freeze({
  RESIDENCE_PERMIT_SERVICE_MONTHLY:Object.freeze({
    datasetKey:'RESIDENCE_PERMIT_SERVICE_MONTHLY',version:'1',
    columns:['periode','kantor_imigrasi','bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim','total'],
    required:['periode','kantor_imigrasi','bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim'],
    optional:['total'],ignored:['no'],businessKey:['periode','kantor_imigrasi'],measures:['bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim'],derived:['total']
  }),
  PASSPORT_SERVICE_MONTHLY:Object.freeze({
    datasetKey:'PASSPORT_SERVICE_MONTHLY',version:'1',
    columns:['periode','kantor_imigrasi','biasa_24','biasa_48','elektronik_48','e_polikarbonat','total'],
    required:['periode','kantor_imigrasi','biasa_24','biasa_48','elektronik_48','e_polikarbonat'],
    optional:['total'],ignored:['no'],businessKey:['periode','kantor_imigrasi'],measures:['biasa_24','biasa_48','elektronik_48','e_polikarbonat'],derived:['total']
  })
});
function getDb_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw new Error('SPREADSHEET_ID belum dikonfigurasi. Jalankan setupApp().');return SpreadsheetApp.openById(id);}
const READ_CACHE_TTL_SEC=10;
const READ_CACHE_GENERATION_KEY='INTAL_READ_CACHE_GENERATION';
function getReadCacheGeneration_(){const value=Number(PropertiesService.getScriptProperties().getProperty(READ_CACHE_GENERATION_KEY)||0);return Number.isFinite(value)&&value>=0?value:0;}
function bumpReadCacheGeneration_(){const props=PropertiesService.getScriptProperties(),next=getReadCacheGeneration_()+1;props.setProperty(READ_CACHE_GENERATION_KEY,String(next));return next;}
function readCacheGet_(key){try{const raw=CacheService.getScriptCache().get(String(key));return raw?JSON.parse(raw):null;}catch(e){return null;}}
function readCachePut_(key,value,ttl){try{const raw=JSON.stringify(value);if(raw.length>90000) return value;CacheService.getScriptCache().put(String(key),raw,Math.max(1,Math.min(600,Number(ttl)||READ_CACHE_TTL_SEC)));}catch(e){}return value;}
function readCacheKey_(scope,payload){return 'INTAL:v2:g'+getReadCacheGeneration_()+':'+String(scope)+':'+JSON.stringify(payload||{});}
function nowIso_(){return Utilities.formatDate(new Date(),APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX");}
