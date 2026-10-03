const fs=require('fs');
const path=require('path');

const files=fs.readdirSync(__dirname).filter(x=>/\.(gs|js)$/.test(x));
for(const name of files){new Function(fs.readFileSync(path.join(__dirname,name),'utf8'));}

const assert=(condition,message)=>{if(!condition)throw new Error('TEST FAILED: '+message);};
assert(tvNew.includes('function serviceDrillLabel(){return metricLabel(SERVICE_DRILL.key);}'), 'INTAL TV service drilldown defines its metric label before chart rendering');
const tvHtml=fs.readFileSync(path.join(__dirname,'tv.html'),'utf8');
const tvScriptMatch=tvHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
assert(!!tvScriptMatch,'INTAL TV HTML contains a script block');
try{new Function(tvScriptMatch[1]);}catch(e){throw new Error('TEST FAILED: INTAL TV script syntax: '+e.message);}
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

const configPerf=read('Config.gs');
assert(configPerf.includes('CacheService.getScriptCache()'),'Backend read cache uses Apps Script CacheService');
assert(configPerf.includes('raw.length>90000'),'Backend cache bounds payload size');
assert(configPerf.includes('READ_CACHE_TTL_SEC=10'),'Backend read cache TTL is explicit and bounded');
assert(configPerf.includes('function readCacheKey_'),'Backend read cache keys are namespaced');
assert(configPerf.includes("const READ_CACHE_GENERATION_KEY='INTAL_READ_CACHE_GENERATION'"),'Read cache has explicit data generation namespace');
assert(configPerf.includes("function bumpReadCacheGeneration_()"),'Read cache generation can be advanced after canonical writes');
assert(read('ImportService.gs').includes('const cacheGeneration=bumpReadCacheGeneration_();'),'Canonical import advances read cache generation');
assert(read('ImportService.gs').includes('SpreadsheetApp.flush();'),'Canonical import flushes spreadsheet writes before release');
const verification=read('VerificationService.gs');
const passportGovernance=read('PassportGovernanceService.gs');
assert(verification.includes('function verifyDatasetIntegrityV1(datasetKey)'), 'Dataset integrity uses a shared contract-driven verifier');
assert(!verification.includes('rowCount!==80')&&!verification.includes('expectedObservedTotal:258094')&&!verification.includes('grandTotal)!==258094'), 'Residence verification/smoke is not pinned to the original 80-row/258094 baseline');
assert(!verification.includes('rowCount!==80')&&!verification.includes('grandTotal)!==327088')&&!verification.includes('combinedServiceVolume)!==585182'), 'Regression smoke is not pinned to the original fixed totals');
assert(passportGovernance.includes("return verifyDatasetIntegrityV1('PASSPORT_SERVICE_MONTHLY');"), 'Passport governance delegates to shared growth-safe integrity verifier');
assert(!passportGovernance.includes('const expectedRows=80,expectedTotal=327088'), 'Passport integrity is not pinned to the original 80-row/327088 baseline');
assert(read('DashboardService.gs').includes('const serviceColumns=contract.measures.slice();'), 'Residence dashboard measures derive from canonical contract');
assert(verification.includes("smokeVersion:'2-growth-safe'"), 'Regression and production smoke use growth-safe version');


const dashboard=read('DashboardService.gs');
const officeRef=read('OfficeReferenceService.gs');
assert(officeRef.includes("readCacheKey_('office-reference-status')") && officeRef.includes('readCachePut_(cacheKey'), 'Office reference readiness uses bounded cache');
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

assert(dashboard.includes("readCacheKey_('dashboard'"), 'Dashboard read path uses bounded cache');
assert(dashboard.includes("readCacheKey_('map'"), 'GIS read path uses bounded cache');
assert(dashboard.includes('readCachePut_(cacheKey'), 'Dashboard and GIS responses are cached after computation');
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
assert(codeGs.includes("readCacheKey_('running-text-active')") && codeGs.includes('readCachePut_(cacheKey,result,10)'), 'TV running text read path uses bounded cache');
assert(codeGs.includes("view==='tv'?'tv':'index'"), 'doGet routes TV to dedicated tv.html entry');
assert(read('tv.html').includes('INTAL') && read('tv.html').includes('COMMAND DISPLAY'), 'Dedicated TV document exists');
assert(!/<script[^>]+src=["'][^"']*leaflet\.js/i.test(read('tv.html')), 'Dedicated TV entry does not block on Leaflet CDN');
const tv=read('tv.html');
assert(!/<link[^>]+rel=["']stylesheet["'][^>]+href=["'][^"']*leaflet\.css/i.test(tv), 'Dedicated TV entry does not block on Leaflet CSS CDN');
assert(tv.includes('function loadLeafletCss()') && tv.includes("document.createElement('link')"), 'INTAL TV loads Leaflet CSS lazily after shell render');
assert(tv.includes('const [L]=await Promise.all([loadLeaflet(),loadLeafletCss()])'), 'INTAL TV waits for Leaflet assets only at GIS initialization');
assert(tv.includes('function loadLeaflet()') && tv.includes('document.createElement(\'script\')'), 'INTAL TV loads GIS library lazily after shell render');
assert(!tv.match(/<script[^>]*>([\s\S]*?)<\/script>/i)[1].includes('//'), 'INTAL TV client script contains no literal double-slash sequences that Apps Script HTML injection can truncate');
assert(tv.includes("window.addEventListener('error'") && tv.includes("window.addEventListener('unhandledrejection'"), 'INTAL TV surfaces runtime script errors instead of remaining silently in PREPARING');
assert(tv.includes('function startRuntime()') && tv.includes('function scheduleRuntimeStart()') && tv.includes("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRuntime,{once:true});") && tv.includes("else window.setTimeout(startRuntime,0);"), 'INTAL TV starts runtime without depending on the HTML load event');
assert(tv.includes('runtimeStarted:false') && tv.includes('if(TV_STATE.runtimeStarted)return;'), 'INTAL TV prevents duplicate runtime bootstrap');
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
assert(tvCharts.includes('grid-template-columns:minmax(150px,1.08fr) minmax(120px,.92fr)'), 'INTAL TV distribution uses bounded responsive grid layout');
assert(tvCharts.includes('function renderOfficeButtons(d)'), 'INTAL TV renders interactive office buttons');
assert(tvCharts.includes('function openServiceBreakdown(datasetKey)'), 'INTAL TV metric panels open service breakdown modal');
assert(tvCharts.includes('id="serviceBreakdownModal"'), 'INTAL TV service breakdown modal exists');
assert(tvCharts.includes('width:80vw;height:80vh'), 'INTAL TV service breakdown modal targets 80 percent viewport');
assert(tvCharts.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'INTAL TV service breakdown uses responsive service grid');
assert(tvCharts.includes('canonical · seluruh 10 kantor · read-only'), 'INTAL TV service breakdown is aggregated across offices');
assert(tvCharts.includes("call(serviceFn(datasetKey),{periode:'',kantor_imigrasi:'',metric:'total'})"), 'INTAL TV service breakdown requests unfiltered canonical service data');
assert(tvCharts.includes('services.map(x=>'), 'INTAL TV service breakdown renders service categories');
const tvShell=tvCharts.slice(0,tvCharts.indexOf('<script>'));
assert(tvCharts.includes('function bindStaticInteractions()'), 'INTAL TV binds static HTML interactions through client listeners');
assert(tvCharts.includes('data-action="workspace"'), 'INTAL TV workspace control uses a data hook');
assert(tvCharts.includes('data-service-breakdown="RESIDENCE_PERMIT_SERVICE_MONTHLY"') && tvCharts.includes('data-service-breakdown="PASSPORT_SERVICE_MONTHLY"'), 'INTAL TV metric panels use data hooks');
assert(!/\son[a-z]+="/i.test(tvShell), 'INTAL TV static HTML contains no inline event-handler attributes');
assert(tvCharts.includes('class="office-list"'), 'INTAL TV office list container exists');
assert(tvCharts.includes('width:clamp(150px,15vw,300px)'), 'INTAL TV distribution donut scales responsively');
assert(!tvCharts.includes('transform:perspective(520px)'), 'INTAL TV distribution is 2D');
assert(tvCharts.includes('--donut-bg'), 'INTAL TV donut segments are driven by responsive CSS variables');
assert(tvCharts.includes('.donut:before{content:none}'), 'INTAL TV donut has no 3D extrusion layer');
assert(tvCharts.includes('width:75vw;height:75vh'), 'INTAL TV office detail modal targets 75 percent viewport');
assert(tvCharts.includes('function openOfficeDetail(office)'), 'INTAL TV office detail handler exists');
assert(tvCharts.includes('kantor_imigrasi:office'), 'INTAL TV office detail uses canonical office filter');
assert(tvCharts.includes('grid-template-columns:minmax(70px,.84fr) minmax(90px,1fr) 52px'), 'INTAL TV service rows fit the readable compact service panel');
assert(tvCharts.includes('all.slice(0,8)'), 'INTAL TV service list caps visible rows to prevent clipping');
assert(tvCharts.includes('service-more'), 'INTAL TV service list exposes hidden-row count');
assert(tvCharts.includes('class="rank-fill"'), 'INTAL TV has visual ranking bars');
const perfTv=read('tv.html');
assert(perfTv.includes('async function preload('), 'INTAL TV preloads service data');
assert(perfTv.includes('const CACHE={}'), 'INTAL TV has client-side service cache');
assert(perfTv.includes('function showLayer'), 'INTAL TV swaps cached GIS layers');
assert(perfTv.includes('async function rotateServiceSafely()'), 'INTAL TV rotates service presentation through guarded runtime seam');
assert(perfTv.includes('Promise.all([stageServiceSnapshot(SERVICES[0]),stageServiceSnapshot(SERVICES[1])])'), 'INTAL TV stages dashboard and GIS snapshots in parallel');
const tvNew=read('tv.html');
assert(tvNew.includes('getActiveRunningTexts'), 'INTAL TV loads managed running text content');
assert(!tvNew.includes('>RUNNING TEXT</'), 'INTAL TV does not display technical RUNNING TEXT label');
assert(tvNew.includes('function renderDistribution'), 'INTAL TV has visual service distribution');
assert(tvNew.includes('function renderTrend'), 'INTAL TV has visual trend chart');
assert(tvNew.includes('function buildLayer'), 'INTAL TV has visual GIS marker layer');
// GIS office combined detail regression invariants
assert(tvCharts.includes('function openGisOfficeDetail(office)'), 'INTAL TV GIS office markers open combined office detail');
assert(tvCharts.includes('id="gisOfficeModal"'), 'INTAL TV GIS office combined modal exists');
assert(tvCharts.includes('width:80vw;height:80vh'), 'INTAL TV GIS office combined modal targets 80 percent viewport');
assert(tvCharts.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'INTAL TV GIS office combined modal uses two-domain responsive layout');
assert(tvCharts.includes('serviceFn(SERVICES[0])') && tvCharts.includes('serviceFn(SERVICES[1])'), 'INTAL TV GIS office detail loads Residence and Passport through canonical dashboard endpoints');
assert(tvCharts.includes('kantor_imigrasi:name') && tvCharts.includes("metric:'total'"), 'INTAL TV GIS office detail filters both domains to the clicked office');
assert(tvCharts.includes('Promise.allSettled([call(serviceFn(SERVICES[0]),filters),call(serviceFn(SERVICES[1]),filters)])'), 'INTAL TV GIS office detail requests both domains in parallel');
assert(tvCharts.includes('gisOfficeResidenceBody') && tvCharts.includes('gisOfficePassportBody'), 'INTAL TV GIS office detail renders separate Residence and Passport sections');
assert(tvCharts.includes('Total Gabungan'), 'INTAL TV GIS office detail exposes combined office total');
assert(tvCharts.includes('GIS_OFFICE_DETAIL_CACHE'), 'INTAL TV GIS office detail uses bounded client cache');
assert(tvCharts.includes(".on('click',()=>openGisOfficeDetail(office))"), 'INTAL TV GIS markers open detail on marker/label click');
assert(!tvCharts.includes(".bindPopup('<b>'+esc(m.kantor_imigrasi)"), 'INTAL TV GIS markers no longer use separate total-only popup');
assert(tvCharts.includes('function closeGisOfficeDetail()'), 'INTAL TV GIS office combined modal has explicit close handler');
assert(tvCharts.includes("if(!$('gisOfficeModal').classList.contains('hidden'))closeGisOfficeDetail()"), 'INTAL TV GIS office combined modal closes with Escape');

assert(tvNew.includes('Promise.all([stageServiceSnapshot(SERVICES[0]),stageServiceSnapshot(SERVICES[1])])'), 'INTAL TV stages dashboard and GIS snapshots in parallel');

// INTAL TV readable/compact visual regression invariants
assert(tvCharts.includes('font-size:10px;font-weight:1000'), 'INTAL TV office totals retain compact responsive typography');
assert(tvCharts.includes('font-size:clamp(12px,1vw,17px)'), 'INTAL TV running text typography scales responsively');
assert(tvCharts.includes('background:#d62f3f'), 'INTAL TV running text LIVE badge remains red');
assert(tvCharts.includes('overflow-y:auto;overflow-x:hidden'), 'INTAL TV office list prevents vertical panel clipping');

// Summary grid overflow regression
assert(tvCharts.includes('grid-template-columns:1fr'), 'INTAL TV office list keeps one office button per row');
assert(tvCharts.includes('min-height:0;min-width:0;overflow-y:auto'), 'INTAL TV office list remains shrink-safe and scrollable');
assert(tvCharts.includes('.office-btn{width:100%'), 'INTAL TV office controls fill the bounded panel width');

// INTAL TV summary overflow and continuous running-text regression invariants
assert(tvCharts.includes('grid-template-rows:auto minmax(0,1fr)'), 'INTAL TV office panel reserves header before scroll content');
assert(tvCharts.includes('.summary{grid-column:3;grid-row:2;display:grid;grid-template-rows:auto minmax(0,1fr)'), 'INTAL TV office panel is a bounded grid so the office list can scroll');
assert(tvCharts.includes('grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px'), 'INTAL TV office detail service values align horizontally with their labels');
assert(tvCharts.includes('font-size:12px;font-weight:900;line-height:1.15'), 'INTAL TV office detail service labels are enlarged');
assert(tvCharts.includes('font-size:22px;font-weight:1000;line-height:1'), 'INTAL TV office detail service values are enlarged');
assert(tvCharts.includes('class="office-btn"'), 'INTAL TV office entries use dedicated interactive controls');
assert(tvCharts.includes('animation:tickerLoop 45s linear infinite'), 'INTAL TV running text uses continuous linear animation');
assert(tvCharts.includes('ticker-item::after'), 'INTAL TV running text has blue separator bullets');
assert(tvCharts.includes('getActiveRunningTexts'), 'INTAL TV running text reads active database content');
const codeSource=read('Code.gs');
assert(codeSource.includes('function getRunningTextSheet_(){return getDb_().getSheetByName(SHEETS.RUNNING_TEXTS)||null;}'), 'Running text read path has non-mutating sheet lookup');
const activeStart=codeSource.indexOf('function getActiveRunningTexts()');
const activeFn=codeSource.slice(activeStart,activeStart+1400);
assert(activeFn.includes('getRunningTextSheet_()')&&!activeFn.includes('ensureRunningTextSheet_()'), 'Running text read endpoint cannot create storage');
assert(codeSource.includes("if(startAt&&!Number.isFinite(startMs))throw new Error('Waktu mulai tidak valid.')"), 'Running text validates start date');
assert(codeSource.includes("if(endAt&&!Number.isFinite(endMs))throw new Error('Waktu selesai tidak valid.')"), 'Running text validates end date');

assert(!tvCharts.includes('tickerIndex'), 'INTAL TV running text no longer rotates by timed index');

// Service distribution readability regression
assert(tvCharts.includes('font-size:clamp(8.5px,.68vw,10px)'), 'INTAL TV service labels scale for readability');
assert(tvCharts.includes('height:10px;background:#102e4b'), 'INTAL TV service bars remain compact but readable');
assert(tvCharts.includes('align-content:start'), 'INTAL TV service distribution remains bounded within panel');

// Distribution responsive centered visual regression
assert(tvCharts.includes('width:clamp(150px,15vw,300px)'), 'INTAL TV donut scales responsively without circular container sizing');
assert(tvCharts.includes('padding:clamp(8px,1.2vw,16px) clamp(10px,1.5vw,20px) clamp(14px,1.8vw,22px)'), 'INTAL TV distribution group has safe vertical centering space');
assert(tvCharts.includes('font-size:clamp(9px,.75vw,14px)'), 'INTAL TV distribution legend scales responsively');

// INTAL TV office list interaction invariants
assert(tvCharts.includes('overflow-y:auto;overflow-x:hidden'), 'INTAL TV office list is a vertical scroll container');
assert(tvCharts.includes('overscroll-behavior:contain'), 'INTAL TV office list contains scroll chaining');
assert(tvCharts.includes('-webkit-overflow-scrolling:touch'), 'INTAL TV office list supports touch momentum scrolling');
assert(tvCharts.includes('touch-action:pan-y'), 'INTAL TV office list permits vertical touch gestures');
assert(tvCharts.includes('cursor:grab'), 'INTAL TV office list exposes drag affordance');
assert(tvCharts.includes('function enableOfficeListInteraction()'), 'INTAL TV office list has explicit pointer interaction');
assert(tvCharts.includes("tabindex=\"0\""), 'INTAL TV office list can receive keyboard focus');
assert(tvCharts.includes("e.key==='ArrowDown'"), 'INTAL TV office list supports ArrowDown keyboard scrolling');
assert(tvCharts.includes("e.key==='PageDown'"), 'INTAL TV office list supports PageDown keyboard scrolling');
assert(tvCharts.includes("if(el.setPointerCapture&&!el.hasPointerCapture(e.pointerId))el.setPointerCapture(e.pointerId)"), 'INTAL TV office drag captures pointer only after movement so click remains available');

// INTAL TV expandable analytics panel invariants
assert(tvCharts.includes('.expandable-card{cursor:pointer'), 'Top 10 and distribution cards are explicitly interactive');
assert(tvCharts.includes('.expand-dialog{width:80vw;height:80vh'), 'Expanded analytics dialogs use the 80% viewport baseline');
assert(tvCharts.includes('function openTop10Modal()'), 'Top 10 has a dedicated large-view modal');
assert(tvCharts.includes('function openDistributionModal()'), 'Distribution has a dedicated large-view modal');
assert(tvCharts.includes('id="top10Modal"'), 'Top 10 modal exists');
assert(tvCharts.includes('id="distributionModal"'), 'Distribution modal exists');
assert(tvCharts.includes('CACHE[currentService]?.dashboard'), 'Expanded views reuse the canonical active dashboard snapshot');
assert(tvCharts.includes('closeTop10Modal()')&&tvCharts.includes('closeDistributionModal()'), 'Expanded analytics modals have explicit close paths');
assert(tvCharts.includes("if(!$('top10Modal').classList.contains('hidden'))closeTop10Modal()"), 'Escape closes the Top 10 modal');
assert(tvCharts.includes("if(!$('distributionModal').classList.contains('hidden'))closeDistributionModal()"), 'Escape closes the distribution modal');

// Interactive distribution modal invariants
assert(tvCharts.includes('.expand-donut-segment{cursor:pointer'), 'Distribution donut segments are interactive');
assert(tvCharts.includes('function setDistributionActive(index)'), 'Distribution selection state is centralized');
assert(tvCharts.includes('onmouseenter="setDistributionActive('), 'Distribution supports pointer hover');
assert(tvCharts.includes('onfocus="setDistributionActive('), 'Distribution supports keyboard focus');
assert(tvCharts.includes('role="button"'), 'Distribution legend items are keyboard-actionable');
assert(tvCharts.includes('grid-template-columns:14px minmax(110px,1fr) auto'), 'Distribution legend keeps labels and percentages visually compact');
assert(tvCharts.includes('window.__distributionData=data'), 'Interactive distribution retains canonical category data');
assert(tvCharts.includes('window.__distributionGrandTotal'), 'Interactive distribution retains canonical grand total');
// Interactive service drilldown invariants
assert(tvCharts.includes('function openServiceDrilldown(key)'), 'Service bars open a dedicated drilldown');
assert(tvCharts.includes('.service-drill-dialog{width:80vw;height:80vh'), 'Service drilldown uses the 80% viewport baseline');
assert(tvCharts.includes('role="button" data-service-key'), 'Service rows are keyboard/click actionable');
assert(tvCharts.includes('metric:String(key)'), 'Service drilldown reads the selected canonical service metric');
assert(tvCharts.includes('function selectServiceDrillPeriod(period)'), 'Service drilldown supports period selection');
assert(tvCharts.includes('function selectServiceDrillOffice(office)'), 'Service drilldown supports office selection');
assert(tvCharts.includes('function resetServiceDrillOffice()'), 'Service drilldown can return to all offices');
assert(tvCharts.includes('SERVICE_DRILL.baseDashboard'), 'Service drilldown preserves its canonical base snapshot');
assert(tvCharts.includes('serviceDrillChart'), 'Service drilldown renders a period trend chart');
assert(tvCharts.includes('serviceDrillOffices'), 'Service drilldown renders office distribution');
assert(tvCharts.includes("if(!$('serviceDrillModal').classList.contains('hidden'))closeServiceDrilldown()"), 'Escape closes service drilldown');
// Runtime data/GIS isolation invariants
assert(tvCharts.includes('const dashboardPromise=withTimeout(call(serviceFn(key),filters),TV_RUNTIME.requestTimeoutMs)'), 'INTAL TV starts canonical dashboard request as the primary runtime path');
assert(tvCharts.includes('const mapPromise=withTimeout(call(mapFn(key),filters),TV_RUNTIME.requestTimeoutMs)'), 'INTAL TV starts GIS request in parallel without making it a boot dependency');
assert(tvCharts.includes("if(!validDashboard(dashboard))throw new Error('TV_RUNTIME_INVALID_DASHBOARD')"), 'Dashboard remains the required runtime dependency');
assert(tvCharts.includes('return {dashboard,mapData:null,mapPromise'), 'INTAL TV can commit dashboard data before GIS completes');
assert(tvCharts.includes('if(!mapData&&snapshot.mapPromise)mapData=await snapshot.mapPromise'), 'GIS completion is handled after canonical dashboard commit');
assert(tvCharts.includes('function ensureSnapshotMap(key,snapshot)'), 'GIS rendering is best-effort after canonical data commit');
assert(tvCharts.includes("if(!active||!validDashboard(active.dashboard))"), 'Boot validity requires canonical dashboard data, not GIS availability');
// INTAL TV P0 runtime hardening invariants

assert(tvUi.includes('data-service="RESIDENCE_PERMIT_SERVICE_MONTHLY"') && tvUi.includes('data-service="PASSPORT_SERVICE_MONTHLY"'), 'INTAL TV service switch uses data-service hooks instead of inline handlers');
assert(!tvUi.includes('id="switchResidence" class="switch active" onclick=' ) && !tvUi.includes('id="switchPassport" class="switch" onclick='), 'INTAL TV service switch has no inline onclick attributes');
assert(tvNew.includes('function bindServiceSwitches()') && tvNew.includes("button.addEventListener('click',()=>activateService(button.dataset.service))"), 'INTAL TV binds service switching through client event listeners');
assert(tvNew.includes("window.__INTAL_TV_CLIENT_EXECUTED=true"), 'INTAL TV exposes an early client execution marker');
assert(tvNew.includes("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRuntime,{once:true});") && tvNew.includes("else window.setTimeout(startRuntime,0);"), 'INTAL TV starts runtime without depending on the window load event');
assert(tvNew.includes('const TV_RUNTIME=Object.freeze'), 'INTAL TV runtime hardening contract exists');
assert(tvNew.includes("refreshMs:60000") && tvNew.includes("rotationMs:30000"), 'INTAL TV refresh and rotation cadence are explicit');
assert(tvNew.includes("staleAfterMs:180000"), 'INTAL TV stale threshold is explicit');
assert(tvNew.includes("requestTimeoutMs:20000"), 'INTAL TV request timeout is bounded');
assert(tvNew.includes("function validDashboard(d)"), 'INTAL TV validates dashboard snapshots before commit');
assert(tvNew.includes("function validMapData(d)"), 'INTAL TV validates GIS snapshots before commit');
assert(tvNew.includes("async function fetchVerifiedSnapshot(key)"), 'INTAL TV has verified snapshot fetch seam');
assert(tvNew.includes("const dashboardPromise=withTimeout(call(serviceFn(key),filters),TV_RUNTIME.requestTimeoutMs)") && tvNew.includes("const mapPromise=withTimeout(call(mapFn(key),filters),TV_RUNTIME.requestTimeoutMs)"), 'INTAL TV starts dashboard and GIS requests in parallel');
assert(tvNew.includes("async function refreshAllRuntimeData()"), 'INTAL TV has atomic all-service refresh cycle');
assert(tvNew.includes("async function stageServiceSnapshot(key)"), 'INTAL TV stages snapshots before commit');
assert(tvNew.includes("function commitServiceSnapshot(key,snapshot,L)"), 'INTAL TV commits staged snapshots through one seam');
assert(tvNew.includes("const [res,pass]=await Promise.all([stageServiceSnapshot(SERVICES[0]),stageServiceSnapshot(SERVICES[1])])"), 'INTAL TV stages both services before commit');
assert(tvNew.includes("commitServiceSnapshot(SERVICES[0],res,null);") && tvNew.includes("commitServiceSnapshot(SERVICES[1],pass,null);"), 'INTAL TV commits both valid dashboard snapshots before optional GIS rendering');
assert(tvNew.includes("await refreshAllRuntimeData();"), 'INTAL TV bootstrap uses atomic runtime refresh');
assert(tvNew.includes("async function preload(key){\n  if(CACHE[key]?.dashboard)return CACHE[key];"), 'INTAL TV preload requires canonical dashboard data only');
assert(!tvNew.includes("const [res,pass]=await Promise.all([refreshService(SERVICES[0]),refreshService(SERVICES[1])])"), 'INTAL TV no longer mutates cache independently during atomic refresh');

assert(tvNew.includes("await loadRunningTexts();\n    renderKpis();"), 'INTAL TV refresh cycle refreshes managed running text content');
assert(tvNew.includes("TV_STATE.refreshing"), 'INTAL TV prevents overlapping refresh cycles');
assert(tvNew.includes("LIVE SYSTEM · REFRESHING"), 'INTAL TV exposes refreshing runtime state');
assert(tvNew.includes("LIVE SYSTEM · STALE"), 'INTAL TV exposes stale runtime state');
assert(tvNew.includes("LIVE SYSTEM · OFFLINE"), 'INTAL TV exposes offline runtime state');
assert(tvNew.includes("LIVE SYSTEM · DEGRADED"), 'INTAL TV exposes degraded runtime state');
assert(tvNew.includes("Menampilkan data terakhir yang valid"), 'INTAL TV preserves last-known-good data on refresh failure');
assert(tvNew.includes("async function rotateServiceSafely()"), 'INTAL TV has guarded service rotation');
assert(tvNew.includes("TV_STATE.rotationBusy"), 'INTAL TV prevents overlapping rotation cycles');
assert(tvNew.includes("setInterval(rotateServiceSafely,TV_RUNTIME.rotationMs)"), 'INTAL TV uses hardened rotation scheduler');
assert(tvNew.includes("function scheduleRuntimeStart()"), 'INTAL TV uses an explicit runtime load scheduler');
assert(tvNew.includes("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRuntime,{once:true});") && tvNew.includes("else window.setTimeout(startRuntime,0);"), 'INTAL TV starts runtime without depending on the Apps Script HTML load event');
assert(tvNew.includes("runtimeStarted:false"), 'INTAL TV prevents duplicate runtime bootstrap');
assert(tvNew.includes("setInterval(refreshAllRuntimeData,TV_RUNTIME.refreshMs)"), 'INTAL TV uses hardened refresh scheduler');
assert(tvNew.includes("document.addEventListener('visibilitychange'"), 'INTAL TV refreshes after returning to visible state');
assert(!tvNew.includes("setInterval(()=>{currentService=currentService===SERVICES[0]?SERVICES[1]:SERVICES[0];activateService(currentService);},30000)"), 'INTAL TV no longer uses unguarded rotation scheduler');
assert(!tvNew.includes("setInterval(()=>{preload(SERVICES[0]).catch(()=>{});preload(SERVICES[1]).catch(()=>{});loadRunningTexts();},60000)"), 'INTAL TV no longer uses blind background refresh scheduler');
