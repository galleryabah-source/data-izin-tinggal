const fs=require('fs');
const path=require('path');

const files=fs.readdirSync(__dirname).filter(x=>/\.(gs|js)$/.test(x));
for(const name of files){new Function(fs.readFileSync(path.join(__dirname,name),'utf8'));}

const assert=(condition,message)=>{if(!condition)throw new Error('TEST FAILED: '+message);};
const read=(name)=>fs.readFileSync(path.join(__dirname,name),'utf8');

const importCode=read('ImportService.gs');
const pureImport=new Function(importCode+'\nreturn {normalizePeriod_,normalizeInteger_};')();
assert(pureImport.normalizePeriod_('2026-01')==='2026-01','YYYY-MM period');
assert(pureImport.normalizePeriod_('Januari 2026')==='2026-01','Indonesian month period');
assert(pureImport.normalizePeriod_('8/2026')==='2026-08','numeric month period');
assert(pureImport.normalizeInteger_('1,234','bvk')===1234,'integer comma normalization');

const backupCode=read('BackupService.gs');
const pureBackup=new Function(backupCode+'\nreturn {normalizeDriveFolderId_};')();
assert(pureBackup.normalizeDriveFolderId_('1b6GMIv-zc10m4YTAqJRRD9tLBJu2VIVg')==='1b6GMIv-zc10m4YTAqJRRD9tLBJu2VIVg','raw Drive folder ID');
assert(pureBackup.normalizeDriveFolderId_('https://drive.google.com/drive/folders/1b6GMIv-zc10m4YTAqJRRD9tLBJu2VIVg?usp=sharing')==='1b6GMIv-zc10m4YTAqJRRD9tLBJu2VIVg','Drive folder URL normalization');
assert(backupCode.includes('function verifyResidencePermitSnapshot(snapshotSpreadsheetId)'), 'snapshot verification endpoint exists');
assert(backupCode.includes('SNAPSHOT_NOT_FOUND'), 'snapshot verification handles missing snapshot');
assert(backupCode.includes('content_sha256'), 'snapshot verification checks manifest checksum');
assert(backupCode.includes('inConfiguredFolder'), 'snapshot verification checks configured backup folder');

const dashboard=read('DashboardService.gs');
const officeRef=read('OfficeReferenceService.gs');
assert(officeRef.includes('function getOfficeReferenceStatus()'), 'office reference readiness endpoint exists');
assert(officeRef.includes("requirePermission_('map.read')"), 'map readiness is RBAC protected');
assert(officeRef.includes("status!=='VERIFIED'"), 'map readiness requires verified reference rows');
assert(officeRef.includes('function prepareOfficeReferenceDraftMetadata()'), 'office reference draft metadata repair exists');
assert(officeRef.includes('function previewOfficeReferenceGeocoding()'), 'office reference geocoding preview exists');
assert(officeRef.includes('Maps.newGeocoder()'), 'office reference geocoding uses Apps Script Maps service');
assert(officeRef.includes("status==='VERIFIED'"), 'geocoding preview skips verified rows');
assert(officeRef.includes('function seedOfficeReferenceDraft()'), 'office reference draft seeding endpoint exists');
assert(officeRef.includes("requirePermission_('admin.config')"), 'office reference draft seeding is admin protected');
assert(officeRef.includes("status:'PENDING'"), 'office reference draft seed never marks rows VERIFIED');
assert(officeRef.includes('if(rows.length)sh.getRange'), 'office reference draft seed writes only missing offices');

assert(dashboard.includes('function getResidencePermitDrilldown(filters)'), 'drill-down endpoint exists');
assert(dashboard.includes('function getResidencePermitMap(filters)'), 'map endpoint exists');
assert(dashboard.includes("requirePermission_('map.read')"), 'map endpoint is RBAC protected');
assert(dashboard.includes('getOfficeReferenceStatus()'), 'map endpoint enforces office reference readiness');
assert(dashboard.includes("status==='VERIFIED'"), 'map endpoint reads verified office references only');
assert(dashboard.includes('OFFICE_REFERENCE_MISSING_FOR_DATASET'), 'map endpoint rejects missing office reference');
assert(dashboard.includes("requirePermission_('dataset.read')"), 'drill-down is RBAC protected');
const ui=read('index.html');
assert(ui.includes('getResidencePermitDrilldown'), 'UI invokes drill-down endpoint');
assert(ui.includes('read-only'), 'UI marks drill-down read-only');
assert(ui.includes('leaflet@1.9.4'), 'Map v1 pins Leaflet version');
assert(ui.includes('getResidencePermitMap'), 'UI invokes map endpoint');
assert(ui.includes('tile.openstreetmap.org'), 'Map v1 uses OpenStreetMap tiles');
assert(ui.includes('Peta Layanan Izin Tinggal'), 'Map v1 section exists');

const config=read('Config.gs');
assert(config.includes("const OFFICE_REFERENCE_CONTRACT = Object.freeze"), 'Office Reference v1 contract exists');
assert(config.includes("DEPLOYMENT_ID:'AKfycbzwhcpZWp8LhyidPFsvqwBQ6ZrgXjEB60NkyNmaQYsiewsvm9uZ_pwPdrG5xZINF2NK'"), 'canonical Apps Script deployment ID is pinned');
assert(config.includes("RELEASE_EVIDENCE_VERSION:'1'"), 'release evidence contract version is pinned');
assert(config.includes("'office_key','kantor_imigrasi','address','latitude','longitude','source_url','verified_at','status'"), 'Office Reference v1 columns are defined');
const contractColumns=['periode','kantor_imigrasi','bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim','total'];
for(const key of ['RESIDENCE_PERMIT_SERVICE_MONTHLY',...contractColumns])assert(config.includes(key),'contract contains '+key);

const fixture=[
['2026-01','A',100,200,300,4,5,6,7,8,9,10,11,12,13],
['2026-01','B',10,20,30,1,2,3,4,5,6,7,8,9,10],
['2026-02','A',50,60,70,1,2,3,4,5,6,7,8,9,10]
];
const serviceIndexes=Array.from({length:13},(_,i)=>i+2);
const rowTotal=r=>serviceIndexes.reduce((sum,i)=>sum+Number(r[i]||0),0);
assert(rowTotal(fixture[0])===685,'fixture row total');
assert(rowTotal(fixture[1])===115,'fixture row total B');
assert(rowTotal(fixture[2])===235,'fixture row total A Feb');
const allTotal=fixture.reduce((sum,r)=>sum+rowTotal(r),0);
assert(allTotal===1035,'fixture grand total');

const periodRows=fixture.filter(r=>r[0]==='2026-01');
assert(periodRows.length===2,'period filter row count');
assert(periodRows.reduce((sum,r)=>sum+rowTotal(r),0)===800,'period filter total');

const officeRows=fixture.filter(r=>r[1]==='A');
assert(officeRows.length===2,'office filter row count');
assert(officeRows.reduce((sum,r)=>sum+rowTotal(r),0)===920,'office filter total');

const combined=fixture.filter(r=>r[0]==='2026-01'&&r[1]==='B');
assert(combined.length===1,'combined filter row count');
assert(rowTotal(combined[0])===115,'combined filter total');

const csvEscape=(value)=>{const s=String(value??'');return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
const header=contractColumns;
const csv=[header.map(csvEscape).join(',')].concat(combined.map(r=>r.map(csvEscape).concat([rowTotal(r)]).join(','))).join('\n');
assert(csv.split('\n').length===2,'CSV header + one data row');
assert(csv.split('\n')[0].split(',').length===16,'CSV column count');

console.log('GAS source syntax: OK');
console.log('Data Contract v1 checks: OK');
console.log('Import normalization checks: OK');
console.log('Dashboard filter invariants: OK');
console.log('CSV export invariants: OK');
console.log('Backup folder normalization: OK');
console.log('Automated smoke test: PASS');

const passportGovernance=read('PassportGovernanceService.gs');
assert(passportGovernance.includes('function verifyPassportServiceMonthly()'),'Passport integrity verification endpoint exists');
assert(passportGovernance.includes('327088'),'Passport integrity expected aggregate is pinned');
assert(passportGovernance.includes('PASSPORT_INTEGRITY_VERIFY'),'Passport integrity writes audit evidence');
assert(passportGovernance.includes('function exportPassportServiceMonthly(filters)'),'Passport export endpoint exists');
assert(passportGovernance.includes("requirePermission_('dataset.export')"),'Passport export is RBAC protected');
assert(passportGovernance.includes('function createPassportServiceSnapshot()'),'Passport backup snapshot endpoint exists');
assert(passportGovernance.includes('function verifyPassportServiceSnapshot(snapshotSpreadsheetId)'),'Passport backup verification endpoint exists');
assert(passportGovernance.includes('content_sha256'),'Passport backup verifies checksum');


const dashboardCode=read('DashboardService.gs');
assert(dashboardCode.includes('function getPassportDashboard(filters)'), 'Passport dashboard endpoint exists');
assert(dashboardCode.includes("getServiceDashboard_('PASSPORT_SERVICE_MONTHLY"), 'Passport dashboard uses service-scoped dataset');
assert(dashboardCode.includes('function getPassportDrilldown(filters)'), 'Passport drilldown endpoint exists');
assert(dashboardCode.includes('function getPassportMap(filters)'), 'Passport map endpoint exists');
assert(dashboardCode.includes('PASSPORT_SERVICE_MONTHLY'), 'Passport dashboard dataset is explicit');
const uiCode=read('index.html');
assert(uiCode.includes('id="serviceFilter"'), 'dashboard service selector exists');
assert(uiCode.includes('getPassportDashboard'), 'UI routes dashboard to Passport endpoint');
assert(uiCode.includes('getPassportDrilldown'), 'UI routes drilldown to Passport endpoint');
assert(uiCode.includes('getPassportMap'), 'UI routes map to Passport endpoint');

const configCode=read('Config.gs');
const configFn=new Function(configCode+'\nreturn {DATASET_CONTRACTS,APP};')();
const passportContract=configFn.DATASET_CONTRACTS.PASSPORT_SERVICE_MONTHLY;
assert(passportContract.columns.length===7,'Passport contract column count');
assert(JSON.stringify(passportContract.businessKey)===JSON.stringify(['periode','kantor_imigrasi']),'Passport business key');
assert(JSON.stringify(passportContract.measures)===JSON.stringify(['biasa_24','biasa_48','elektronik_48','e_polikarbonat']),'Passport measures');
assert(passportContract.derived.includes('total'),'Passport derived total');

const passportImport=new Function(
  'APP','DATASET_CONTRACTS','getDatasetBySignature_','getDb_',
  importCode+'\nreturn {validateRows_};'
)(
  configFn.APP,
  configFn.DATASET_CONTRACTS,
  ()=>null,
  ()=>({getSheetByName:()=>({getDataRange:()=>({getValues:()=>[[]]})})})
);
const passportSchema={
  contractKey:'PASSPORT_SERVICE_MONTHLY',
  sourceColumns:['periode','kantor_imigrasi','biasa_24','biasa_48','elektronik_48','e_polikarbonat','total'],
  columns:passportContract.columns,
  signature:'test-passport'
};
const passportRows=[
  ['2026-01','OFFICE A','1','2','300','4','307'],
  ['2026-02','OFFICE B','0','5','10','0','15']
];
const passportCheck=passportImport.validateRows_(passportSchema,passportRows);
assert(passportCheck.valid.length===2,'Passport fixture validation accepts valid rows');
assert(passportCheck.errors.length===0,'Passport fixture validation has no errors');
assert(passportCheck.valid[0][6]===307,'Passport total derived dynamically');

const mismatch=passportImport.validateRows_(passportSchema,[['2026-01','OFFICE C','1','2','3','4','999']]);
assert(mismatch.valid.length===0,'Passport total mismatch rejected');
assert(mismatch.errors.length===1,'Passport mismatch produces one error');

const duplicate=passportImport.validateRows_(passportSchema,[['2026-01','OFFICE D','1','2','3','4','10'],['2026-01','OFFICE D','2','3','4','5','14']]);
assert(duplicate.valid.length===1,'Passport duplicate business key rejects second row');
assert(duplicate.duplicates===1,'Passport duplicate count is one');

const fixturePath=path.join(__dirname,'..','fixtures','PASSPORT_SERVICE_MONTHLY_v1.tsv');
const fixtureText=fs.readFileSync(fixturePath,'utf8').trim();
const fixtureLines=fixtureText.split(/\r?\n/).map(line=>line.split('\t'));
const fixtureHeader=fixtureLines.shift();
const fixtureSchema={...passportSchema,sourceColumns:fixtureHeader,columns:passportContract.columns};
const realFixtureCheck=passportImport.validateRows_(fixtureSchema,fixtureLines);
assert(realFixtureCheck.valid.length===80,'real Passport fixture has 80 valid rows');
assert(realFixtureCheck.errors.length===0,'real Passport fixture has no validation errors');
assert(realFixtureCheck.duplicates===0,'real Passport fixture has no duplicate keys');
assert(realFixtureCheck.valid.reduce((sum,row)=>sum+Number(row[6]||0),0)===327088,'real Passport fixture grand total');

const residenceContract=configFn.DATASET_CONTRACTS.RESIDENCE_PERMIT_SERVICE_MONTHLY;
assert(residenceContract.measures.length===13,'Residence Permit measures preserved');
assert(residenceContract.columns.indexOf('total')===15,'Residence Permit total position preserved');


const verificationCode=read('VerificationService.gs');
assert(verificationCode.includes('function runDashboardRegressionSmokeV1()'), 'dashboard regression smoke endpoint exists');
assert(verificationCode.includes('residence_dashboard'), 'regression smoke checks Residence Permit dashboard');
assert(verificationCode.includes('passport_dashboard'), 'regression smoke checks Passport dashboard');
assert(verificationCode.includes('residence_drilldown'), 'regression smoke checks Residence Permit drilldown');
assert(verificationCode.includes('passport_drilldown'), 'regression smoke checks Passport drilldown');
assert(verificationCode.includes('residence_map'), 'regression smoke checks Residence Permit map');
assert(verificationCode.includes('passport_map'), 'regression smoke checks Passport map');
assert(verificationCode.includes('DASHBOARD_REGRESSION_SMOKE'), 'regression smoke writes audit evidence');
assert(dashboard.includes("getServiceDrilldown_('PASSPORT_SERVICE_MONTHLY',filters,'month')"), 'Passport drilldown uses monthly display mode');
assert(ui.includes('runDashboardRegressionSmokeV1'), 'UI exposes dashboard regression smoke');\nassert(ui.includes('GIS First · Production'), 'GIS First production shell exists');
assert(ui.includes('Peta sebagai pusat analisis'), 'GIS First analytical intent is present');
assert(ui.includes('id="mapSection"'), 'GIS map is a primary dashboard surface');
assert(ui.includes('id="svcResidence"') && ui.includes('id="svcPassport"'), 'service selector exists in top shell');

assert(verificationCode.includes('function runProductionSmokeTestV1()'), 'production smoke test endpoint exists');
assert(verificationCode.includes("PRODUCTION_SMOKE_TEST"), 'production smoke test audit event exists');
assert(verificationCode.includes("dashboard_baseline"), 'smoke test checks dashboard baseline');
assert(verificationCode.includes("drilldown_baseline"), 'smoke test checks drilldown baseline');
assert(verificationCode.includes("map_baseline"), 'smoke test checks map baseline');
assert(verificationCode.includes("export_verification"), 'smoke test checks export verification');
assert(verificationCode.includes("backup_snapshot"), 'smoke test checks backup snapshot');
