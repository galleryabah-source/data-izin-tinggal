function getDashboardSummary(){
  requirePermission_('dashboard.read');
  const datasets=listDatasets();
  let total=0;
  datasets.forEach(d=>total+=d.rowCount);
  return {totalRecords:total,datasets:datasets.map(d=>({datasetKey:d.datasetKey,rowCount:d.rowCount,columns:d.columns}))};
}

function getResidencePermitDashboard(filters){
  requirePermission_('dashboard.read');
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
  const monthly={},offices={},services={};
  serviceColumns.forEach(c=>services[c]=0);
  let grandTotal=0;
  rows.forEach(r=>{
    const period=periodOf_(r);
    const office=officeOf_(r);
    const total=Number(r[hi.total]||0);
    grandTotal+=total;
    if(!monthly[period])monthly[period]={periode:period,total:0,rows:0};
    monthly[period].total+=total;
    monthly[period].rows++;
    if(!offices[office])offices[office]={kantor_imigrasi:office,total:0,rows:0};
    offices[office].total+=total;
    offices[office].rows++;
    serviceColumns.forEach(c=>services[c]+=Number(r[hi[c]]||0));
  });
  return {
    datasetKey,
    rowCount:rows.length,
    filters:{periode:requestedPeriod,kantor_imigrasi:requestedOffice,availablePeriods,availableOffices},
    grandTotal,
    monthly:Object.values(monthly).sort((a,b)=>a.periode.localeCompare(b.periode)),
    offices:Object.values(offices).sort((a,b)=>b.total-a.total),
    services:serviceColumns.map(c=>({key:c,total:services[c]}))
  };
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
  rows.forEach(r=>csv.push(r.map(csvEscape_).join(',')));
  const suffix=requestedPeriod||requestedOffice?'_filtered':'_all';
  const filename=datasetKey.toLowerCase()+suffix+'_'+Utilities.formatDate(new Date(),APP.TZ,'yyyyMMdd_HHmmss')+'.csv';
  appendAudit_('DATASET_EXPORT',datasetKey,'',rows.length,'SUCCESS',JSON.stringify({format:'csv',periode:requestedPeriod,kantor_imigrasi:requestedOffice,filename}));
  return {ok:true,filename,rowCount:rows.length,content:csv.join('\n')};
}

function getResidencePermitDrilldown(filters){
  requirePermission_('dataset.read');
  const datasetKey='RESIDENCE_PERMIT_SERVICE_MONTHLY';
  const ss=getDb_(),registry=ss.getSheetByName(SHEETS.DATASET_REGISTRY);
  const rv=registry.getDataRange().getValues(),rh=rv[0]||[],ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
  const reg=rv.slice(1).find(r=>String(r[ri.dataset_key]||'')===datasetKey&&String(r[ri.status]||'').toUpperCase()==='ACTIVE');
  if(!reg)throw new Error('DATASET_NOT_REGISTERED');
  const sheetName=String(reg[ri.sheet_name]||APP.SHEET_PREFIX+datasetKey),sh=ss.getSheetByName(sheetName);
  if(!sh)throw new Error('DATASET_SHEET_NOT_FOUND: '+sheetName);
  const values=sh.getDataRange().getValues();
  if(values.length<2)return {datasetKey,columns:[],rows:[],rowCount:0};
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const requestedPeriod=String((filters&&filters.periode)||'').trim();
  const requestedOffice=String((filters&&filters.kantor_imigrasi)||'').trim();
  const periodOf_=r=>{const raw=r[hi.periode];return raw instanceof Date?Utilities.formatDate(raw,APP.TZ,'yyyy-MM'):String(raw||'').trim();};
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const rows=values.slice(1).filter(r=>r.some(v=>String(v)!=='')).filter(r=>
    (!requestedPeriod||periodOf_(r)===requestedPeriod)&&(!requestedOffice||officeOf_(r)===requestedOffice)
  );
  const output=rows.map(r=>header.map((_,idx)=>{
    const v=r[idx];
    return v instanceof Date?Utilities.formatDate(v,APP.TZ,'yyyy-MM-dd'):v;
  }));
  appendAudit_('DATASET_DRILLDOWN',datasetKey,'',output.length,'SUCCESS',JSON.stringify({periode:requestedPeriod,kantor_imigrasi:requestedOffice}));
  return {datasetKey,columns:header,rowCount:output.length,rows:output,filters:{periode:requestedPeriod,kantor_imigrasi:requestedOffice}};
}
