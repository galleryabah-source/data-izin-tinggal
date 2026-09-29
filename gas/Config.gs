const APP = Object.freeze({NAME:'Data Izin Tinggal',VERSION:'0.2.0',TZ:'Asia/Jakarta',MAX_IMPORT_ROWS:5000,MAX_CELL_CHARS:50000,SHEET_PREFIX:'DATA_'});
const SHEETS = Object.freeze({CONFIG:'CONFIG',USERS:'USERS',ROLES:'ROLES',PERMISSIONS:'PERMISSIONS',DATA_DICTIONARY:'DATA_DICTIONARY',DATASET_REGISTRY:'DATASET_REGISTRY',IMPORT_LOG:'IMPORT_LOG',AUDIT_LOG:'AUDIT_LOG'});
const DEFAULT_ROLES = {
  ADMIN:['dashboard.read','dataset.read','dataset.write','dataset.import','dataset.export','dataset.approve','dataset.delete','map.read','admin.users','admin.roles','admin.config','audit.read'],
  SUPERVISOR:['dashboard.read','dataset.read','dataset.write','dataset.import','dataset.export','dataset.approve','map.read'],
  OPERATOR:['dashboard.read','dataset.read','dataset.write','dataset.import','map.read'],
  VIEWER:['dashboard.read','dataset.read','map.read'],
  AUDITOR:['dashboard.read','dataset.read','audit.read']
};
const DATASET_CONTRACTS = Object.freeze({
  RESIDENCE_PERMIT_SERVICE_MONTHLY:Object.freeze({
    datasetKey:'RESIDENCE_PERMIT_SERVICE_MONTHLY',version:'1',
    columns:['periode','kantor_imigrasi','bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim','total'],
    required:['periode','kantor_imigrasi','bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim'],
    optional:['total'],ignored:['no'],businessKey:['periode','kantor_imigrasi'],derived:['total']
  })
});
function getDb_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw new Error('SPREADSHEET_ID belum dikonfigurasi. Jalankan setupApp().');return SpreadsheetApp.openById(id);}
function nowIso_(){return Utilities.formatDate(new Date(),APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX");}
