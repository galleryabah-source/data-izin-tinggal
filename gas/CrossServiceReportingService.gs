/**
 * Phase 10.1 — Cross-Service Reporting
 *
 * Read-only semantic adapter over the existing canonical monthly datasets.
 * No source dataset, importer, registry identity, or historical baseline is modified.
 */
function getCrossServiceReport(filters){
  requirePermission_('dashboard.read');

  const f=filters||{};
  const requestedPeriod=String(f.periode||'').trim();
  const requestedOffice=String(f.kantor_imigrasi||'').trim();

  const sources=[
    {service:'RESIDENCE_PERMIT',datasetKey:'RESIDENCE_PERMIT_SERVICE_MONTHLY'},
    {service:'PASSPORT',datasetKey:'PASSPORT_SERVICE_MONTHLY'}
  ];

  const series=sources.map(source=>getCrossServiceSeries_(source,requestedPeriod,requestedOffice));
  const combined=series.reduce((sum,s)=>sum+s.serviceVolume,0);

  return {
    version:'1',
    metric:'service_volume',
    readOnly:true,
    filters:{
      periode:requestedPeriod,
      kantor_imigrasi:requestedOffice
    },
    services:series,
    combinedServiceVolume:combined,
    provenance:series.map(s=>({
      service:s.service,
      datasetKey:s.datasetKey,
      sourceMetric:'total',
      metric:'service_volume'
    }))
  };
}

function getCrossServiceSeries_(source,requestedPeriod,requestedOffice){
  const d=getActiveDatasetContract_(source.datasetKey);
  const values=d.sheet.getDataRange().getValues();
  if(values.length<2){
    return {
      service:source.service,
      datasetKey:source.datasetKey,
      serviceVolume:0,
      rowCount:0,
      monthly:[],
      offices:[]
    };
  }

  const header=values[0];
  const hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const periodOf_=r=>{
    const raw=r[hi.periode];
    return raw instanceof Date?Utilities.formatDate(raw,APP.TZ,'yyyy-MM'):String(raw||'').trim();
  };
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();

  const rows=values.slice(1)
    .filter(r=>r.some(v=>String(v)!==''))
    .filter(r=>
      (!requestedPeriod||periodOf_(r)===requestedPeriod) &&
      (!requestedOffice||officeOf_(r)===requestedOffice)
    );

  const monthly={},offices={};
  let serviceVolume=0;

  rows.forEach(r=>{
    const period=periodOf_(r);
    const office=officeOf_(r);
    const total=Number(r[hi.total]||0);

    serviceVolume+=total;

    if(!monthly[period])monthly[period]={periode:period,serviceVolume:0,rowCount:0};
    monthly[period].serviceVolume+=total;
    monthly[period].rowCount++;

    if(!offices[office])offices[office]={kantor_imigrasi:office,serviceVolume:0,rowCount:0};
    offices[office].serviceVolume+=total;
    offices[office].rowCount++;
  });

  return {
    service:source.service,
    datasetKey:source.datasetKey,
    serviceVolume,
    rowCount:rows.length,
    monthly:Object.values(monthly).sort((a,b)=>a.periode.localeCompare(b.periode)),
    offices:Object.values(offices).sort((a,b)=>b.serviceVolume-a.serviceVolume)
  };
}
