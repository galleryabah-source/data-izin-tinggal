function getDashboardSummary(){
  requirePermission_('dashboard.read');
  const datasets=listDatasets();
  let total=0;
  datasets.forEach(d=>total+=d.rowCount);
  return {totalRecords:total,datasets:datasets.map(d=>({datasetKey:d.datasetKey,rowCount:d.rowCount,columns:d.columns}))};
}

function getResidencePermitDashboard(filters){
  requirePermission_('dashboard.read');
  const cacheKey=readCacheKey_('dashboard',{dataset:'RESIDENCE_PERMIT_SERVICE_MONTHLY',filters:filters||{}});
  const cached=readCacheGet_(cacheKey);if(cached)return cached;
  const datasetKey='RESIDENCE_PERMIT_SERVICE_MONTHLY';
  const ss=getDb_();
  const registry=ss.getSheetByName(SHEETS.DATASET_REGISTRY);
  const rv=registry.getDataRange().getValues();
  const rh=rv[0]||[];
  const ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
  const reg=rv.slice(1).find(r=>String(r[ri.dataset_key]||'')===datasetKey&&String(r[ri.status]||'').toUpperCase()==='ACTIVE');
  if(!reg)throw new Error('DATASET_NOT_REGISTERED');
  const sheetName=String(reg[ri.sheet_name]||APP.SHEET_PREFIX+datasetKey);
  const sh=ss.getSheetByName(sheetName);
  if(!sh)throw new Error('DATASET_SHEET_NOT_FOUND: '+sheetName);
  const values=sh.getDataRange().getValues();
  if(values.length<2)return {datasetKey,rowCount:0,grandTotal:0,monthly:[],offices:[],services:[]};
  const header=values[0];
  const hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const requestedPeriod=String((filters&&filters.periode)||'').trim();
  const requestedOffice=String((filters&&filters.kantor_imigrasi)||'').trim();
  const requestedMetric=String((filters&&filters.metric)||'total').trim()||'total';
  const allRows=values.slice(1).filter(r=>r.some(v=>String(v)!==''));
  const periodOf_=r=>{
    const raw=r[hi.periode];
    return raw instanceof Date ? Utilities.formatDate(raw,APP.TZ,'yyyy-MM') : String(raw||'').trim();
  };
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const availablePeriods=[...new Set(allRows.map(periodOf_).filter(Boolean))].sort();
  const availableOffices=[...new Set(allRows.map(officeOf_).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
  const rows=allRows.filter(r=>
    (!requestedPeriod || periodOf_(r)===requestedPeriod) &&
    (!requestedOffice || officeOf_(r)===requestedOffice)
  );
  const serviceColumns=['bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim'];
  const supportedMetrics=['total'].concat(serviceColumns);
  if(supportedMetrics.indexOf(requestedMetric)===-1)throw new Error('DASHBOARD_METRIC_NOT_SUPPORTED: '+requestedMetric);
  const metricIndex=requestedMetric==='total'?hi.total:hi[requestedMetric];
  if(metricIndex===undefined)throw new Error('DASHBOARD_METRIC_COLUMN_NOT_FOUND: '+requestedMetric);
  const monthly={},offices={},services={};
  serviceColumns.forEach(c=>services[c]=0);
  let grandTotal=0;
  rows.forEach(r=>{
    const period=periodOf_(r);
    const office=officeOf_(r);
    const total=Number(r[hi.total]||0),metricValue=Number(r[metricIndex]||0);
    grandTotal+=metricValue;
    if(!monthly[period])monthly[period]={periode:period,total:0,rows:0};
    monthly[period].total+=metricValue;
    monthly[period].rows++;
    if(!offices[office])offices[office]={kantor_imigrasi:office,total:0,rows:0};
    offices[office].total+=metricValue;
    offices[office].rows++;
    serviceColumns.forEach(c=>services[c]+=Number(r[hi[c]]||0));
  });
  return readCachePut_(cacheKey,{datasetKey,rowCount:rows.length,filters:{periode:requestedPeriod,kantor_imigrasi:requestedOffice,metric:requestedMetric,availablePeriods,availableOffices},metric:requestedMetric,grandTotal,monthly:Object.values(monthly).sort((a,b)=>a.periode.localeCompare(b.periode)),offices:Object.values(offices).sort((a,b)=>b.total-a.total),services:serviceColumns.map(c=>({key:c,total:services[c]}))},READ_CACHE_TTL_SEC);
}




function getPassportDashboard(filters){
  return getServiceDashboard_('PASSPORT_SERVICE_MONTHLY',['biasa_24','biasa_48','elektronik_48','e_polikarbonat'],filters);
}

function getServiceDashboard_(datasetKey,serviceColumns,filters){
  requirePermission_('dashboard.read');
  const cacheKey=readCacheKey_('dashboard',{dataset:datasetKey,filters:filters||{}});
  const cached=readCacheGet_(cacheKey);if(cached)return cached;
  const d=getActiveDatasetContract_(datasetKey);
  const values=d.sheet.getDataRange().getValues();
  if(values.length<2)return {datasetKey,rowCount:0,metric:'total',grandTotal:0,monthly:[],offices:[],services:[],filters:{periode:'',kantor_imigrasi:'',metric:'total',availablePeriods:[],availableOffices:[]}};
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const requestedPeriod=String((filters&&filters.periode)||'').trim();
  const requestedOffice=String((filters&&filters.kantor_imigrasi)||'').trim();
  const requestedMetric=String((filters&&filters.metric)||'total').trim()||'total';
  const supportedMetrics=['total'].concat(serviceColumns);
  if(supportedMetrics.indexOf(requestedMetric)===-1)throw new Error('DASHBOARD_METRIC_NOT_SUPPORTED: '+requestedMetric);
  const metricIndex=requestedMetric==='total'?hi.total:hi[requestedMetric];
  if(metricIndex===undefined)throw new Error('DASHBOARD_METRIC_COLUMN_NOT_FOUND: '+requestedMetric);
  const allRows=values.slice(1).filter(r=>r.some(v=>String(v)!==''));
  const periodOf_=r=>{const raw=r[hi.periode];return raw instanceof Date?Utilities.formatDate(raw,APP.TZ,'yyyy-MM'):String(raw||'').trim();};
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const availablePeriods=[...new Set(allRows.map(periodOf_).filter(Boolean))].sort();
  const availableOffices=[...new Set(allRows.map(officeOf_).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
  const rows=allRows.filter(r=>(!requestedPeriod||periodOf_(r)===requestedPeriod)&&(!requestedOffice||officeOf_(r)===requestedOffice));
  const monthly={},offices={},services={};serviceColumns.forEach(c=>services[c]=0);
  let grandTotal=0;
  rows.forEach(r=>{
    const period=periodOf_(r),office=officeOf_(r),metricValue=Number(r[metricIndex]||0);
    grandTotal+=metricValue;
    if(!monthly[period])monthly[period]={periode:period,total:0,rows:0};
    monthly[period].total+=metricValue;monthly[period].rows++;
    if(!offices[office])offices[office]={kantor_imigrasi:office,total:0,rows:0};
    offices[office].total+=metricValue;offices[office].rows++;
    serviceColumns.forEach(c=>services[c]+=Number(r[hi[c]]||0));
  });
  return readCachePut_(cacheKey,{datasetKey,rowCount:rows.length,metric:requestedMetric,filters:{periode:requestedPeriod,kantor_imigrasi:requestedOffice,metric:requestedMetric,availablePeriods,availableOffices},grandTotal,monthly:Object.values(monthly).sort((a,b)=>a.periode.localeCompare(b.periode)),offices:Object.values(offices).sort((a,b)=>b.total-a.total),services:serviceColumns.map(c=>({key:c,total:services[c]}))},READ_CACHE_TTL_SEC);
}

function getPassportMap(filters){
  return getServiceMap_('PASSPORT_SERVICE_MONTHLY',filters);
}

function getServiceMap_(datasetKey,filters){
  requirePermission_('map.read');
  const cacheKey=readCacheKey_('map',{dataset:datasetKey,filters:filters||{}});
  const cached=readCacheGet_(cacheKey);if(cached)return cached;
  const readiness=getOfficeReferenceStatus();
  if(!readiness.ready)throw new Error('OFFICE_REFERENCE_NOT_READY');
  const d=getActiveDatasetContract_(datasetKey),values=d.sheet.getDataRange().getValues();
  if(values.length<2)return {datasetKey,rowCount:0,markers:[],metric:'total',filters:{periode:'',kantor_imigrasi:'',metric:'total'}};
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const requestedPeriod=String((filters&&filters.periode)||'').trim();
  const requestedOffice=String((filters&&filters.kantor_imigrasi)||'').trim();
  const requestedMetric=String((filters&&filters.metric)||'total').trim()||'total';
  const supportedMetrics=['total'].concat(d.contract.measures||[]);
  if(supportedMetrics.indexOf(requestedMetric)===-1)throw new Error('MAP_METRIC_NOT_SUPPORTED: '+requestedMetric);
  const metricIndex=requestedMetric==='total'?hi.total:hi[requestedMetric];
  if(metricIndex===undefined)throw new Error('MAP_METRIC_COLUMN_NOT_FOUND: '+requestedMetric);
  const periodOf_=r=>{const raw=r[hi.periode];return raw instanceof Date?Utilities.formatDate(raw,APP.TZ,'yyyy-MM'):String(raw||'').trim();};
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const rows=values.slice(1).filter(r=>r.some(v=>String(v)!=='')).filter(r=>(!requestedPeriod||periodOf_(r)===requestedPeriod)&&(!requestedOffice||officeOf_(r)===requestedOffice));
  const ref=getDb_().getSheetByName('OFFICE_REFERENCE'),rv=ref.getDataRange().getValues(),rh=rv[0]||[],ri=Object.fromEntries(rh.map((x,n)=>[x,n])),byOffice={};
  rv.slice(1).filter(r=>r.some(v=>String(v)!=='')).forEach(r=>{const name=String(r[ri.kantor_imigrasi]||'').trim(),status=String(r[ri.status]||'').trim().toUpperCase();if(name&&status==='VERIFIED')byOffice[name]=r;});
  const markers={};
  rows.forEach(r=>{
    const office=officeOf_(r),reference=byOffice[office];if(!reference)throw new Error('OFFICE_REFERENCE_MISSING_FOR_DATASET: '+office);
    const lat=Number(reference[ri.latitude]),lng=Number(reference[ri.longitude]);if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('OFFICE_REFERENCE_COORDINATE_INVALID: '+office);
    if(!markers[office])markers[office]={office_key:String(reference[ri.office_key]||''),kantor_imigrasi:office,address:String(reference[ri.address]||''),latitude:lat,longitude:lng,source_url:String(reference[ri.source_url]||''),total:0,metricValue:0,rows:0};
    markers[office].total+=Number(r[hi.total]||0);
    markers[office].metricValue+=Number(r[metricIndex]||0);
    markers[office].rows++;
  });
  return readCachePut_(cacheKey,{datasetKey,rowCount:rows.length,metric:requestedMetric,filters:{periode:requestedPeriod,kantor_imigrasi:requestedOffice,metric:requestedMetric},markers:Object.values(markers).sort((a,b)=>b.metricValue-a.metricValue)},READ_CACHE_TTL_SEC);
}

function csvEscape_(value){
  const s=String(value===null||value===undefined?'':value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}

function exportResidencePermitMonthly(filters){
  const user=requirePermission_('dataset.export');
  const datasetKey='RESIDENCE_PERMIT_SERVICE_MONTHLY';
  const ss=getDb_();
  const registry=ss.getSheetByName(SHEETS.DATASET_REGISTRY);
  const rv=registry.getDataRange().getValues(),rh=rv[0]||[],ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
  const reg=rv.slice(1).find(r=>String(r[ri.dataset_key]||'')===datasetKey&&String(r[ri.status]||'').toUpperCase()==='ACTIVE');
  if(!reg)throw new Error('DATASET_NOT_REGISTERED');
  const sheetName=String(reg[ri.sheet_name]||APP.SHEET_PREFIX+datasetKey),sh=ss.getSheetByName(sheetName);
  if(!sh)throw new Error('DATASET_SHEET_NOT_FOUND: '+sheetName);
  const values=sh.getDataRange().getValues();
  if(values.length<2)throw new Error('DATASET_EMPTY');
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const requestedPeriod=String((filters&&filters.periode)||'').trim();
  const requestedOffice=String((filters&&filters.kantor_imigrasi)||'').trim();
  const periodOf_=r=>{const raw=r[hi.periode];return raw instanceof Date?Utilities.formatDate(raw,APP.TZ,'yyyy-MM'):String(raw||'').trim();};
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const rows=values.slice(1).filter(r=>r.some(v=>String(v)!=='')).filter(r=>
    (!requestedPeriod||periodOf_(r)===requestedPeriod)&&(!requestedOffice||officeOf_(r)===requestedOffice)
  );
  const csv=[header.map(csvEscape_).join(',')];
  rows.forEach(r=>csv.push(header.map((_,idx)=>{
    const value=r[idx];
    return value instanceof Date ? Utilities.formatDate(value,APP.TZ,'yyyy-MM') : value;
  }).map(csvEscape_).join(',')));
  const suffix=requestedPeriod||requestedOffice?'_filtered':'_all';
  const filename=datasetKey.toLowerCase()+suffix+'_'+Utilities.formatDate(new Date(),APP.TZ,'yyyyMMdd_HHmmss')+'.csv';
  appendAudit_('DATASET_EXPORT',datasetKey,'',rows.length,'SUCCESS',JSON.stringify({format:'csv',periode:requestedPeriod,kantor_imigrasi:requestedOffice,filename}));
  return {ok:true,filename,rowCount:rows.length,content:csv.join('\n')};
}

function getResidencePermitDrilldown(filters){
  return getServiceDrilldown_('RESIDENCE_PERMIT_SERVICE_MONTHLY',filters,'month');
}

function getPassportDrilldown(filters){
  return getServiceDrilldown_('PASSPORT_SERVICE_MONTHLY',filters,'month');
}

function getServiceDrilldown_(datasetKey,filters,periodMode){
  requirePermission_('dataset.read');
  const d=getActiveDatasetContract_(datasetKey),values=d.sheet.getDataRange().getValues();
  if(values.length<2)return {datasetKey,columns:[],rows:[],rowCount:0,totalRows:0,totalPages:0,page:1,pageSize:0};
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const f=filters||{};
  const requestedPeriod=String(f.periode||'').trim();
  const requestedOffice=String(f.kantor_imigrasi||'').trim();
  const search=String(f.search||'').trim().toLowerCase();
  const requestedSort=String(f.sortBy||'').trim();
  const sortIndex=Object.prototype.hasOwnProperty.call(hi,requestedSort)?hi[requestedSort]:hi.periode;
  const sortDir=String(f.sortDir||'asc').toLowerCase()==='desc'?-1:1;
  const page=Math.max(1,Number(f.page)||1);
  const pageSize=Math.min(100,Math.max(10,Number(f.pageSize)||20));
  const periodOf_=r=>{const raw=r[hi.periode];return raw instanceof Date?Utilities.formatDate(raw,APP.TZ,periodMode==='month'?'yyyy-MM':'yyyy-MM-dd'):String(raw||'').trim();};
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  let rows=values.slice(1).filter(r=>r.some(v=>String(v)!=='')).filter(r=>
    (!requestedPeriod||periodOf_(r)===requestedPeriod)&&
    (!requestedOffice||officeOf_(r)===requestedOffice)&&
    (!search||r.some(v=>String(v==null?'':v).toLowerCase().includes(search)))
  );
  rows.sort((a,b)=>{
    const av=a[sortIndex],bv=b[sortIndex];
    const an=Number(av),bn=Number(bv);
    if(String(av??'')!==''&&String(bv??'')!==''&&Number.isFinite(an)&&Number.isFinite(bn))return (an-bn)*sortDir;
    return String(av??'').localeCompare(String(bv??''),'id',{numeric:true,sensitivity:'base'})*sortDir;
  });
  const totalRows=rows.length,totalPages=Math.max(1,Math.ceil(totalRows/pageSize));
  const safePage=Math.min(page,totalPages);
  const offset=(safePage-1)*pageSize;
  const pageRows=rows.slice(offset,offset+pageSize);
  const output=pageRows.map(r=>header.map((_,idx)=>{
    const v=r[idx];
    return v instanceof Date?Utilities.formatDate(v,APP.TZ,periodMode==='month'&&header[idx]==='periode'?'yyyy-MM':'yyyy-MM-dd'):v;
  }));
  appendAudit_('DATASET_DRILLDOWN',datasetKey,'',output.length,'SUCCESS',JSON.stringify({
    periode:requestedPeriod,kantor_imigrasi:requestedOffice,search,page:safePage,pageSize,sortBy:header[sortIndex],sortDir
  }));
  return {
    datasetKey,columns:header,rowCount:output.length,totalRows,totalPages,page:safePage,pageSize,rows:output,
    filters:{periode:requestedPeriod,kantor_imigrasi:requestedOffice,search,sortBy:header[sortIndex],sortDir}
  };
}

function getResidencePermitMap(filters){
  return getServiceMap_('RESIDENCE_PERMIT_SERVICE_MONTHLY',filters);
}
