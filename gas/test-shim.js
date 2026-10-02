const fs=require('fs');
const path=require('path');

const files=fs.readdirSync(__dirname).filter(x=>/\.(gs|js)$/.test(x));
for(const name of files){new Function(fs.readFileSync(path.join(__dirname,name),'utf8'));}

const assert=(condition,message)=>{if(!condition)throw new Error('TEST FAILED: '+message);};
const read=(name)=>fs.readFileSync(path.join(__dirname,name),'utf8');

const authCode=read('Auth.gs');
const SHEETS={USERS:'USERS',PERMISSIONS:'PERMISSIONS'};
const makeSheet=(values)=>({getDataRange:()=>({getValues:()=>values})});
const makeDb=(users,permissions)=>({getSheetByName:(name)=>name==='USERS'?makeSheet(users):makeSheet(permissions)});
const unauthSession={getActiveUser:()=>({getEmail:()=>''})};
const authUnauth=new Function('Session','getDb_','SHEETS',authCode+'\nreturn {requirePermission_};')(unauthSession,()=>makeDb([['user_id','email','display_name','role','status']],[]),SHEETS);
let unauthRejected=false;
try{authUnauth.requirePermission_('dashboard.read');}catch(e){unauthRejected=String(e&&e.message||e)==='UNAUTHENTICATED';}
assert(unauthRejected,'RBAC rejects unauthenticated identity');
const authSession={getActiveUser:()=>({getEmail:()=> 'viewer@example.com'})};
const users=[['user_id','email','display_name','role','status'],['u1','viewer@example.com','Viewer','VIEWER','ACTIVE']];
const permissions=[['role','permission'],['VIEWER','dashboard.read'],['VIEWER','dataset.read']];
const authViewer=new Function('Session','getDb_','SHEETS',authCode+'\nreturn {requirePermission_};')(authSession,()=>makeDb(users,permissions),SHEETS);
let forbiddenRejected=false;
try{authViewer.requirePermission_('admin.config');}catch(e){forbiddenRejected=String(e&&e.message||e)==='FORBIDDEN: admin.config';}
assert(forbiddenRejected,'RBAC rejects unauthorized permission');
assert(authViewer.requirePermission_('dataset.read').role==='VIEWER','RBAC permits assigned permission');

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
assert(dashboard.includes("const requestedMetric=String((filters&&filters.metric)||'total').trim()||'total';"), 'GIS metric defaults to total');
assert(dashboard.includes('MAP_METRIC_NOT_SUPPORTED'), 'GIS metric rejects unsupported values');
assert(dashboard.includes("const supportedMetrics=['total'].concat(d.contract.measures||[]);"), 'GIS metric derives from active dataset measures');
assert(dashboard.includes('metricValue'), 'GIS map exposes selected metric value separately from canonical total');
assert(dashboard.includes("function getServiceMap_(datasetKey,filters)"), 'GIS metric runtime logic is in shared map seam');
assert(dashboard.includes("function getResidencePermitMap(filters){\n  return getServiceMap_('RESIDENCE_PERMIT_SERVICE_MONTHLY',filters);\n}"), 'Residence map delegates to shared GIS map seam');
assert(!dashboard.match(/function exportResidencePermitMonthly\(filters\)\{[\s\S]*?d\.contract\.measures/), 'Residence export does not reference map-only metric contract');
assert(dashboard.match(/function getServiceMap_\(datasetKey,filters\)\{[\s\S]*?const metricIndex=requestedMetric==='total'\?hi\.total:hi\[requestedMetric\];/), 'GIS map declares metric index inside map seam');
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
assert(ui.includes('id="gisMetricFilter"'), 'GIS metric selector exists');
assert(ui.includes('function getMapFilters()'), 'GIS map sends metric filter separately');
assert(ui.includes('function populateMapMetrics(r)'), 'GIS metric selector follows active dataset measures');
assert(ui.includes('metricValue'), 'GIS UI renders selected metric value');

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

const tvUi=read('index.html');
assert(tvUi.includes('id="tvView"'), 'INTAL TV presentation root exists');
assert(tvUi.includes("/\[?&\]view=tv(?:&|$)/.test(String(window.location.search||''))"), 'INTAL TV mode is query-parameter gated');
assert(tvUi.includes("const TV_SERVICES=['RESIDENCE_PERMIT_SERVICE_MONTHLY','PASSPORT_SERVICE_MONTHLY'];"), 'INTAL TV supports Residence and Passport rotation');
assert(tvUi.includes('LIVE SYSTEM · ONLINE'), 'INTAL TV separates live system status');
assert(tvUi.includes('LAST READ'), 'INTAL TV exposes client read timestamp status');
assert(!tvUi.includes('LAST VERIFIED DATA'), 'INTAL TV does not mislabel client read time as verified provenance');
assert(tvUi.includes('RUNNING TEXT'), 'INTAL TV includes running text channel');
assert(tvUi.includes('setInterval(tvRefresh,60000)'), 'INTAL TV auto-refreshes presentation data');
assert(tvUi.includes('tvRotationTimer=setInterval'), 'INTAL TV rotates service presentation');
assert(tvUi.includes("getPassportDashboard"), 'INTAL TV routes Passport through canonical dashboard endpoint');
assert(tvUi.includes("getResidencePermitDashboard"), 'INTAL TV routes Residence through canonical dashboard endpoint');
assert(tvUi.includes("getPassportMap"), 'INTAL TV routes Passport GIS through canonical map endpoint');
assert(tvUi.includes("getResidencePermitMap"), 'INTAL TV routes Residence GIS through canonical map endpoint');
assert(tvUi.includes("metric:'total'"), 'INTAL TV GIS defaults to canonical total metric');

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
assert(dashboardCode.includes('const search=String(f.search||\'\').trim().toLowerCase()'), 'Data Explorer backend supports server-side search');
assert(dashboardCode.includes('const totalRows=rows.length,totalPages=Math.max(1,Math.ceil(totalRows/pageSize))'), 'Data Explorer backend supports pagination');
assert(dashboardCode.includes('rows.sort((a,b)=>'), 'Data Explorer backend supports server-side sorting');
assert(dashboardCode.includes('pageRows=rows.slice(offset,offset+pageSize)'), 'Data Explorer backend slices requested page');

assert(dashboardCode.includes('function getPassportDashboard(filters)'), 'Passport dashboard endpoint exists');
assert(dashboardCode.includes("getServiceDashboard_('PASSPORT_SERVICE_MONTHLY"), 'Passport dashboard uses service-scoped dataset');
assert(dashboardCode.includes('function getPassportDrilldown(filters)'), 'Passport drilldown endpoint exists');
assert(dashboardCode.includes('function getPassportMap(filters)'), 'Passport map endpoint exists');
assert(dashboardCode.includes('PASSPORT_SERVICE_MONTHLY'), 'Passport dashboard dataset is explicit');
const uiCode=read('index.html');
assert(uiCode.includes('id="svcResidence"') && uiCode.includes('id="svcPassport"'), 'dashboard service selector exists');
assert(uiCode.includes('getPassportDashboard'), 'UI routes dashboard to Passport endpoint');
assert(uiCode.includes('getPassportDrilldown'), 'UI routes drilldown to Passport endpoint');
assert(uiCode.includes('getPassportMap'), 'UI routes map to Passport endpoint');
assert(uiCode.includes('data-target="dashboard"') && uiCode.includes('data-target="mapSection"') && uiCode.includes('data-target="drilldownSection"'), 'GIS First analysis menus have functional targets');
assert(uiCode.includes('id="gisOfficeSearch"') && uiCode.includes('id="gisOfficeDetail"'), 'GIS workspace has office search and detail panel');
assert(uiCode.includes('function focusGisOffice()') && uiCode.includes('function fitGisMarkers()'), 'GIS workspace has map navigation controls');
assert(uiCode.includes('function renderGisOfficeDetail(m)'), 'GIS workspace has office detail renderer');
assert(uiCode.includes('getResidencePermitMap') && uiCode.includes('getPassportMap'), 'GIS workspace routes through canonical map endpoints');
assert(uiCode.includes('data-target="analytics"') && uiCode.includes('data-target="adminSection"') && uiCode.includes('data-target="registrySection"') && uiCode.includes('data-target="governanceSection"'), 'GIS First operational menus have functional targets');
assert(uiCode.includes('function navigateTo(event,targetId)'), 'sidebar navigation handler exists');
assert(uiCode.includes('id="crossReport"') && uiCode.includes('id="crossReportStatus"'), 'Laporan workspace has cross-service report surface');
assert(uiCode.includes('id="importStatus"') && uiCode.includes('id="importPreview"'), 'Import workspace has workflow status and preview surface');
assert(uiCode.includes('id="monitoringHealth"') && uiCode.includes('id="monitoringStatus"'), 'Monitoring workspace has runtime health surface');
assert(uiCode.includes('function runDashboardRegressionSmoke()'), 'Monitoring workspace invokes regression smoke');
assert(uiCode.includes("callWithTimeout('listDatasets'"), 'Administration workspace uses canonical dataset registry endpoint');
assert(uiCode.includes('Schema Signature'), 'Administration workspace exposes registry identity metadata');
assert(uiCode.includes('function renderImportPreview(r)'), 'Import workspace has preview renderer');
assert(uiCode.includes('function clearImport()'), 'Import workspace has clear workflow');
assert(uiCode.includes("callWithTimeout('previewImport'"), 'Import preview uses governed server endpoint');
assert(uiCode.includes("callWithTimeout('commitImport'"), 'Import commit uses governed server endpoint');
assert(uiCode.includes('function refreshCrossServiceReport()'), 'Laporan workspace calls semantic adapter');
assert(uiCode.includes('getCrossServiceReport'), 'Laporan workspace routes to cross-service endpoint');
assert(uiCode.includes('combinedServiceVolume'), 'Laporan workspace displays combined service volume');
assert(uiCode.includes('function initSidebarNavigation()'), 'sidebar navigation initialization exists');
assert(uiCode.includes("history.replaceState(null,'','#'+targetId)"), 'sidebar navigation updates URL state');
assert(uiCode.includes('IntersectionObserver'), 'sidebar active state follows visible section');
assert(uiCode.includes('id="serviceDistributionSection"'), 'service distribution has a navigable section target');
assert(uiCode.includes('id="drillSearch"') && uiCode.includes('id="drillPageSize"'), 'Data Explorer has search and page-size controls');
assert(uiCode.includes('function sortExplorer(column)'), 'Data Explorer sorting handler exists');
assert(uiCode.includes('function changeExplorerPage(delta)'), 'Data Explorer pagination handler exists');
assert(uiCode.includes('function showExplorerDetail(index)'), 'Data Explorer detail handler exists');
assert(uiCode.includes('getExplorerFilters()'), 'Data Explorer sends server-side explorer filters');


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
assert(verificationCode.includes("Number(residenceDrilldown.totalRows)!==80"),'Residence drilldown smoke validates totalRows rather than paginated rowCount');
assert(verificationCode.includes("Number(passportDrilldown.totalRows)!==80"),'Passport drilldown smoke validates totalRows rather than paginated rowCount');
assert(verificationCode.includes("Number(drilldown.totalRows)!==80"),'Production smoke validates drilldown totalRows rather than paginated rowCount');
assert(verificationCode.includes('function runDashboardRegressionSmokeV1()'), 'dashboard regression smoke endpoint exists');
assert(verificationCode.includes('residence_dashboard'), 'regression smoke checks Residence Permit dashboard');
assert(verificationCode.includes('passport_dashboard'), 'regression smoke checks Passport dashboard');
assert(verificationCode.includes('residence_drilldown'), 'regression smoke checks Residence Permit drilldown');
assert(verificationCode.includes('passport_drilldown'), 'regression smoke checks Passport drilldown');
assert(verificationCode.includes('residence_map'), 'regression smoke checks Residence Permit map');
assert(verificationCode.includes('passport_map'), 'regression smoke checks Passport map');
assert(verificationCode.includes('DASHBOARD_REGRESSION_SMOKE'), 'regression smoke writes audit evidence');
assert(dashboard.includes("getServiceDrilldown_('PASSPORT_SERVICE_MONTHLY',filters,'month')"), 'Passport drilldown uses monthly display mode');
assert(ui.includes('runDashboardRegressionSmokeV1'), 'UI exposes dashboard regression smoke');
assert(ui.includes('GIS First · Production'), 'GIS First production shell exists');
assert(ui.includes('await refreshDashboard();refreshRegistry();'), 'Import commit refreshes dashboard without legacy refresh function');
assert(!/await refresh\(\)/.test(ui), 'UI does not call removed legacy refresh function');
assert(ui.includes("const msg='Dashboard gagal dimuat:"), 'Boot failure message identifies dashboard runtime failures');
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

assert(importCode.includes("const schema=detectSchema_(matrix[0]),lock=LockService.getScriptLock();lock.waitLock(30000);"),'import acquires script lock before validation');
assert(importCode.indexOf('lock.waitLock(30000)')<importCode.indexOf('const check=validateRows_(schema,matrix.slice(1))'),'import validation occurs under script lock');
assert(importCode.indexOf('const check=validateRows_(schema,matrix.slice(1))')<importCode.indexOf('ensureDataset_(schema,user.email)'),'dataset creation occurs after locked validation');
assert(importCode.includes('finally{lock.releaseLock();}'),'import always releases script lock');
const parserImport=new Function(importCode+'\nreturn {parseDelimited_,parseDelimitedLine_};')();
const parsed=parserImport.parseDelimited_('periode,kantor_imigrasi,bvk\n2026-01,"Kantor, Bandung",123');
assert(parsed[1][1]==='Kantor, Bandung','CSV quoted delimiter parsing');
const parsedTab=parserImport.parseDelimited_('periode\tkantor_imigrasi\tbvk\n2026-01\t"Kantor ""A"""\t123');
assert(parsedTab[1][1]==='Kantor "A"','TSV escaped quote parsing');
console.log('Import atomicity and parser edge-case checks: OK');

const datasetService=read('DatasetService.gs');
const datasetIdentity=read('DatasetIdentityService.gs');
assert(datasetIdentity.includes('function verifyDatasetRegistryIntegrityV1()'),'dataset registry integrity verifier exists');
assert(datasetIdentity.includes('DUPLICATE_ACTIVE_')&&datasetIdentity.includes("'dataset_key',identity.datasetKey,byKey"),'registry duplicate dataset-key detection exists');
assert(datasetIdentity.includes('DUPLICATE_ACTIVE_')&&datasetIdentity.includes("'schema_signature',identity.signature,bySignature"),'registry duplicate signature detection exists');
assert(datasetIdentity.includes('DUPLICATE_ACTIVE_')&&datasetIdentity.includes("'sheet_name',identity.sheetName,bySheet"),'registry duplicate sheet detection exists');
assert(datasetIdentity.includes('DATASET_IDENTITY_SIGNATURE_DRIFT'),'schema signature drift is rejected');
assert(datasetIdentity.includes('DATASET_IDENTITY_HEADER_DRIFT'),'physical sheet header drift is rejected');
assert(datasetIdentity.includes('DATASET_IDENTITY_ROW_COUNT_DRIFT'),'registry row-count drift is rejected');
assert(datasetService.includes('DATASET_IDENTITY_ORPHAN_SHEET'),'orphan physical dataset sheet is rejected');
assert(datasetService.includes('DATASET_IDENTITY_CONFLICT: duplicate active schema signature'),'lookup rejects duplicate active schema signatures');
assert(datasetService.includes('active dataset_key already exists with a different identity'),'creation rejects a second active identity for one dataset key');
assert(datasetService.includes('DATASET_IDENTITY_CONFLICT: cannot update row_count'),'row-count update is identity-scoped');
const registryVerifier=new Function(datasetIdentity+'\nreturn {getCanonicalDatasetIdentity_};')();
assert(typeof registryVerifier.getCanonicalDatasetIdentity_==='function','canonical dataset identity verifier compiles');
const verificationCode2=read('VerificationService.gs');
assert(verificationCode2.includes("check_('dataset_registry_identity',()=>verifyDatasetRegistryIntegrityV1())"),'production smoke checks canonical dataset identity');
assert(verificationCode2.includes("check_('cross_service_reporting',()=>getCrossServiceReport({}))"),'production smoke checks cross-service reporting');
console.log('Canonical dataset identity and registry consistency checks: OK');

const crossService=read('CrossServiceReportingService.gs');
assert(crossService.includes('function getCrossServiceReport(filters)'), 'Phase 10.1 cross-service reporting endpoint exists');
assert(crossService.includes("requirePermission_('dashboard.read')"), 'cross-service reporting is RBAC protected');
assert(crossService.includes("metric:'service_volume'"), 'cross-service semantic metric is service_volume');
assert(crossService.includes("sourceMetric:'total'"), 'cross-service provenance retains canonical source total');
assert(crossService.includes('getActiveDatasetContract_(source.datasetKey)'), 'cross-service adapter resolves canonical dataset contracts');
assert(crossService.includes('readOnly:true'), 'cross-service reporting is explicitly read-only');
assert(crossService.includes('combinedServiceVolume'), 'cross-service adapter exposes combined volume without replacing service components');
assert(crossService.includes('RESIDENCE_PERMIT_SERVICE_MONTHLY') && crossService.includes('PASSPORT_SERVICE_MONTHLY'), 'cross-service adapter is limited to canonical monthly datasets');
assert(!crossService.includes('appendRow('), 'cross-service adapter has no write path');
assert(!crossService.includes('setValues('), 'cross-service adapter has no source mutation path');
assert(!crossService.includes('deleteRow('), 'cross-service adapter has no delete path');
const crossServiceCompiled=new Function(
  'requirePermission_','getActiveDatasetContract_','Utilities','APP',
  crossService+'\nreturn {getCrossServiceReport,getCrossServiceSeries_};'
)(
  ()=>{},
  ()=>({sheet:{getDataRange:()=>({getValues:()=>[['periode','kantor_imigrasi','total'],['2026-01','OFFICE A',100]]})}}),
  {formatDate:()=>''},
  {TZ:'Asia/Jakarta'}
);
assert(typeof crossServiceCompiled.getCrossServiceReport==='function','cross-service adapter compiles');
console.log('Phase 10.1 semantic adapter contract checks: OK');

assert(uiCode.includes('href="?view=tv"') && uiCode.includes('INTAL TV'), 'workspace sidebar exposes INTAL TV navigation');
assert(uiCode.includes('function openTv(event)'), 'INTAL TV navigation handler exists');
assert(uiCode.includes('function exitTv()'), 'INTAL TV provides workspace return handler');
assert(uiCode.includes('class="tv-workspace-btn"'), 'INTAL TV provides visible workspace return control');

assert(uiCode.includes("test(String(window.location.search||''))"), 'TV mode detection does not depend on URLSearchParams');
assert(uiCode.includes("tv.classList.remove('hidden')"), 'TV shell is revealed before runtime data loading');
assert(uiCode.includes('BOOT ERROR'), 'TV bootstrap failure is surfaced instead of blank screen');

assert(uiCode.includes('leaflet.js" crossorigin="" defer'), 'Leaflet script is non-blocking');
assert(uiCode.includes("GIS_LIBRARY_LOADING") || uiCode.includes("GIS LOADING"), 'TV handles deferred GIS library loading');

const codeGs=read('Code.gs');
assert(codeGs.includes("view==='tv'?'tv':'index'"), 'doGet routes TV to dedicated tv.html entry');
assert(read('tv.html').includes('INTAL · COMMAND DISPLAY'), 'Dedicated TV document exists');
assert(!/<script[^>]+src=["'][^"']*leaflet\.js/i.test(read('tv.html')), 'Dedicated TV entry does not block on Leaflet CDN');

const tv=read('tv.html');
assert(tv.includes('function loadLeaflet()') && tv.includes('document.createElement(\'script\')'), 'INTAL TV loads GIS library lazily after shell render');
assert(tv.includes("getPassportMap") && tv.includes("getResidencePermitMap"), 'INTAL TV routes GIS to canonical map endpoints');
assert(tv.includes("metric:'total'"), 'INTAL TV preserves total-service map metric default');
assert(tv.includes('getElementById') || tv.includes("$('map')"), 'INTAL TV renders GIS into dedicated map container');

const tvNav=read('tv.html');
assert(tvNav.includes("ScriptApp.getService().getUrl()"), 'TV workspace navigation uses canonical Apps Script Web App URL');
assert(tvNav.includes('function goWorkspace()'), 'TV workspace return handler exists');
assert(tvNav.includes('window.top.location.href=WORKSPACE_URL'), 'TV workspace return targets top-level Web App');
assert(!tvNav.includes('location.href=location.pathname'), 'TV workspace navigation does not rely on sandbox pathname');

const workspaceUi=read('index.html');
assert(workspaceUi.includes("ScriptApp.getService().getUrl()"), 'Workspace TV navigation uses canonical Apps Script Web App URL');
assert(workspaceUi.includes("window.top.location.href=WEB_APP_URL+'?view=tv'"), 'Workspace TV navigation targets top-level TV URL');
assert(!workspaceUi.includes("window.location.pathname+'?view=tv'"), 'Workspace TV navigation does not rely on sandbox pathname');
assert(workspaceUi.includes('href="#" onclick="openTv(event)"'), 'INTAL TV menu uses explicit navigation handler');
