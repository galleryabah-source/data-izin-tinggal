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
assert(dashboard.includes("const supportedMetrics=['total'].concat(serviceColumns);"), 'Dashboard metric filter derives from canonical service measures');
assert(dashboard.includes('DASHBOARD_METRIC_NOT_SUPPORTED'), 'Dashboard metric filter rejects unsupported values');
assert(dashboard.includes('metricIndex=requestedMetric===\'total\'?hi.total:hi[requestedMetric]'), 'Dashboard metric filter resolves canonical metric column');
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

const uiCode=read('index.html');
const tvUi=read('tv.html');
assert(tvUi.includes('class="tv"'), 'INTAL TV presentation root exists');
assert(tvUi.includes('const SERVICES='), 'INTAL TV supports Residence and Passport service views');
assert(tvUi.includes('LIVE SYSTEM'), 'INTAL TV exposes live system status');
assert(tvUi.includes('LAST READ'), 'INTAL TV exposes client read timestamp status');
assert(!tvUi.includes('RUNNING TEXT'), 'INTAL TV does not display technical running-text label');
assert(tvUi.includes('getPassportDashboard') && tvUi.includes('getResidencePermitDashboard'), 'INTAL TV routes both services through canonical dashboard endpoints');
assert(tvUi.includes('getPassportMap') && tvUi.includes('getResidencePermitMap'), 'INTAL TV routes both services through canonical GIS endpoints');
assert(tvUi.includes("metric:'total'"), 'INTAL TV GIS defaults to canonical total metric');
assert(!tvUi.includes('id="tvPeriodFilter"') && !tvUi.includes('id="tvMetricFilter"') && !tvUi.includes('id="tvRegionFilter"'), 'INTAL TV removes the filter bar from command display');
assert(!tvUi.includes('populateTvFilters(d)'), 'INTAL TV no longer calls removed filter initializer');
assert(tvUi.includes('function loadServiceView('), 'INTAL TV loads filtered service views');
assert(tvUi.includes('metric:TV_FILTERS.metric'), 'INTAL TV passes selected metric to canonical endpoints');
assert(tvUi.includes('periode:TV_FILTERS.periode'), 'INTAL TV passes selected period to canonical endpoints');
assert(uiCode.includes('onclick="openTv(event)"') && uiCode.includes('>INTAL TV</a>'), 'workspace sidebar exposes INTAL TV navigation');
assert(uiCode.includes('function openTv(event)'), 'INTAL TV navigation handler exists');
assert(uiCode.includes('function exitTv()'), 'INTAL TV provides workspace return handler');
assert(uiCode.includes('class="tv-workspace-btn"'), 'INTAL TV provides visible workspace return control');
assert(uiCode.includes('Konten TV') && uiCode.includes('id="tvContentSection"'), 'Admin workspace exposes Konten TV management section');
assert(uiCode.includes('admin-only') && uiCode.includes("admin.config"), 'Konten TV UI is restricted to admin.config');
assert(uiCode.includes('loadRunningTextFile') && uiCode.includes('saveRunningTextForm') && uiCode.includes('removeRunningText'), 'Konten TV provides upload, save, and delete controls');

assert(uiCode.includes("test(String(window.location.search||''))"), 'TV mode detection does not depend on URLSearchParams');
assert(uiCode.includes("tv.classList.remove('hidden')"), 'TV shell is revealed before runtime data loading');
assert(uiCode.includes('BOOT ERROR'), 'TV bootstrap failure is surfaced instead of blank screen');

assert(uiCode.includes('leaflet.js" crossorigin="" defer'), 'Leaflet script is non-blocking');
assert(uiCode.includes("GIS_LIBRARY_LOADING") || uiCode.includes("GIS LOADING"), 'TV handles deferred GIS library loading');

const codeGs=read('Code.gs');
const configRunningText=read('Config.gs');
assert(configRunningText.includes("RUNNING_TEXTS:'RUNNING_TEXTS'"), 'Running text sheet is registered in canonical sheet configuration');
assert(codeGs.includes('function ensureRunningTextSheet_()') && codeGs.includes('function saveRunningText(payload)'), 'Running text server endpoints exist');
assert(codeGs.includes("requirePermission_('admin.config')"), 'Running text write endpoints are RBAC protected');
assert(codeGs.includes("function getActiveRunningTexts()") && codeGs.includes("requirePermission_('dashboard.read')"), 'TV active running text read path is RBAC protected');
assert(codeGs.includes("view==='tv'?'tv':'index'"), 'doGet routes TV to dedicated tv.html entry');
assert(read('tv.html').includes('INTAL') && read('tv.html').includes('COMMAND DISPLAY'), 'Dedicated TV document exists');
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

const tvCharts=read('tv.html');
assert(tvCharts.includes('function renderTrend'), 'INTAL TV renders visual trend chart');
assert(tvCharts.includes('function renderDistribution'), 'INTAL TV renders visual service distribution');
assert(tvCharts.includes('class="donut"'), 'INTAL TV has donut visualization');
assert(tvCharts.includes('TOP 10 KANTOR'), 'INTAL TV ranking shows Top 10 offices');
assert(tvCharts.includes("slice(0,10)"), 'INTAL TV renders up to 10 ranked offices');
assert(tvCharts.includes('grid-template-columns:minmax(125px,1fr) minmax(95px,.9fr)'), 'INTAL TV distribution uses bounded compact grid layout');
assert(tvCharts.includes('summary-icon'), 'INTAL TV summary cards include visual icons');
assert(tvCharts.includes('width:min(154px,100%)'), 'INTAL TV distribution donut is compact');
assert(!tvCharts.includes('transform:perspective(520px)'), 'INTAL TV distribution is 2D');
assert(tvCharts.includes('--donut-bg'), 'INTAL TV donut segments are driven by responsive CSS variables');
assert(tvCharts.includes('.donut:before{content:none}'), 'INTAL TV donut has no 3D extrusion layer');
assert(tvCharts.includes('width:38px;height:38px'), 'INTAL TV summary icons fit the bounded summary panel');
assert(tvCharts.includes('grid-template-columns:minmax(62px,.82fr) minmax(70px,1fr) 48px'), 'INTAL TV service rows fit the compact service panel');
assert(tvCharts.includes('all.slice(0,8)'), 'INTAL TV service list caps visible rows to prevent clipping');
assert(tvCharts.includes('service-more'), 'INTAL TV service list exposes hidden-row count');
assert(tvCharts.includes('class="rank-fill"'), 'INTAL TV has visual ranking bars');
const perfTv=read('tv.html');
assert(perfTv.includes('async function preload('), 'INTAL TV preloads service data');
assert(perfTv.includes('const CACHE={}'), 'INTAL TV has client-side service cache');
assert(perfTv.includes('function showLayer'), 'INTAL TV swaps cached GIS layers');
assert(perfTv.includes('setInterval(()=>{currentService=currentService===SERVICES[0]?SERVICES[1]:SERVICES[0];activateService(currentService);},30000)'), 'INTAL TV rotates service presentation');
assert(perfTv.includes('Promise.all([call(serviceFn(key),{}),call(mapFn(key),{metric:\'total\'})])'), 'INTAL TV loads dashboard and GIS data in parallel');
const tvNew=read('tv.html');
assert(tvNew.includes('getActiveRunningTexts'), 'INTAL TV loads managed running text content');
assert(!tvNew.includes('>RUNNING TEXT</'), 'INTAL TV does not display technical RUNNING TEXT label');
assert(tvNew.includes('function renderDistribution'), 'INTAL TV has visual service distribution');
assert(tvNew.includes('function renderTrend'), 'INTAL TV has visual trend chart');
assert(tvNew.includes('function buildLayer'), 'INTAL TV has visual GIS marker layer');
assert(tvNew.includes('Promise.all([call(serviceFn(key),{}),call(mapFn(key),{metric:\'total\'})])'), 'INTAL TV keeps dashboard and GIS preload parallel');

// INTAL TV readable/compact visual regression invariants
assert(tvCharts.includes('font-size:clamp(20px,1.65vw,27px)'), 'INTAL TV summary KPI typography scales responsively');
assert(tvCharts.includes('font-size:clamp(12px,1vw,17px)'), 'INTAL TV running text typography scales responsively');
assert(tvCharts.includes('background:#d62f3f'), 'INTAL TV running text LIVE badge remains red');
assert(tvCharts.includes('height:100%;min-height:0;box-sizing:border-box;overflow:hidden'), 'INTAL TV summary grid prevents bottom clipping');

// Summary grid overflow regression
assert(tvCharts.includes('grid-template-rows:repeat(2,minmax(0,1fr))'), 'INTAL TV summary uses bounded two-row grid');
assert(tvCharts.includes('min-height:0;overflow:hidden;box-sizing:border-box'), 'INTAL TV summary container is shrink-safe');
assert(tvCharts.includes('height:auto;min-width:0;box-sizing:border-box;overflow:hidden'), 'INTAL TV summary cards do not force 100% height overflow');
