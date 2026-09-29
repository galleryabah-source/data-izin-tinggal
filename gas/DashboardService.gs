function getDashboardSummary(){
  requirePermission_('dashboard.read');
  const datasets=listDatasets();
  let total=0;
  datasets.forEach(d=>total+=d.rowCount);
  return {totalRecords:total,datasets:datasets.map(d=>({datasetKey:d.datasetKey,rowCount:d.rowCount,columns:d.columns}))};
}

function getResidencePermitDashboard(){
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
  const rows=values.slice(1).filter(r=>r.some(v=>String(v)!==''));
  const serviceColumns=['bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim'];
  const monthly={},offices={},services={};
  serviceColumns.forEach(c=>services[c]=0);
  let grandTotal=0;
  rows.forEach(r=>{
    const rawPeriod=r[hi.periode];
    const period=rawPeriod instanceof Date ? Utilities.formatDate(rawPeriod,APP.TZ,'yyyy-MM') : String(rawPeriod||'').trim();
    const office=String(r[hi.kantor_imigrasi]||'');
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
    grandTotal,
    monthly:Object.values(monthly).sort((a,b)=>a.periode.localeCompare(b.periode)),
    offices:Object.values(offices).sort((a,b)=>b.total-a.total),
    services:serviceColumns.map(c=>({key:c,total:services[c]}))
  };
}
