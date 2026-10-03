function getDatasetTemporalProfileV1(datasetKey){
  requirePermission_('dataset.read');
  const d=getActiveDatasetContract_(datasetKey),contract=d.contract,values=d.sheet.getDataRange().getValues();
  const header=values[0]||[],hi=Object.fromEntries(header.map((x,n)=>[x,n])),periodKey=contract.periodKey||'periode';
  const rows=values.slice(1).filter(r=>r.some(v=>String(v)!==''));
  const periods=[...new Set(rows.map(r=>String(r[hi[periodKey]]||'').trim()).filter(Boolean))].sort();
  return {
    datasetKey,
    periodGrain:contract.periodGrain||'month',
    periodKey,
    rowCount:rows.length,
    periodCount:periods.length,
    firstPeriod:periods[0]||null,
    lastPeriod:periods[periods.length-1]||null,
    sourceOfTruth:contract.periodGrain==='year'?'authoritative_annual':'authoritative_monthly'
  };
}

function getAnnualRollupFromMonthlyV1(datasetKey,filters){
  requirePermission_('dashboard.read');
  const d=getActiveDatasetContract_(datasetKey),contract=d.contract;
  if(contract.periodGrain!=='month')throw new Error('ANNUAL_ROLLUP_REQUIRES_MONTHLY_DATASET: '+datasetKey);
  const f=filters||{},requestedYear=String(f.year||f.periode||'').trim(),requestedOffice=String(f.kantor_imigrasi||'').trim();
  if(requestedYear&&!/^[1-9][0-9]{3}$/.test(requestedYear))throw new Error('Tahun harus berupa YYYY.');
  const values=d.sheet.getDataRange().getValues();
  if(values.length<2)return {datasetKey,periodGrain:'year',sourceGrain:'month',readOnly:true,year:requestedYear,rows:[]};
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n])),rows=values.slice(1).filter(r=>r.some(v=>String(v)!==''));
  const periodOf_=r=>String(r[hi.periode]||'').trim(),officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const selected=rows.filter(r=>{
    const period=periodOf_(r),office=officeOf_(r);
    return (!requestedYear||period.slice(0,4)===requestedYear)&&(!requestedOffice||office===requestedOffice);
  });
  const totals={};contract.measures.concat(['total']).forEach(k=>totals[k]=0);
  selected.forEach(r=>contract.measures.concat(['total']).forEach(k=>{totals[k]+=Number(r[hi[k]]||0);}));
  return {
    datasetKey,
    periodGrain:'year',
    sourceGrain:'month',
    readOnly:true,
    year:requestedYear||null,
    kantor_imigrasi:requestedOffice||null,
    sourceRows:selected.length,
    sourcePeriods:[...new Set(selected.map(periodOf_).filter(Boolean))].sort(),
    totals,
    provenance:{sourceDatasetKey:datasetKey,sourceMetric:'canonical_monthly',aggregation:'sum(monthly)','targetGrain':'year'}
  };
}

function getTemporalDatasetSummaryV1(datasetKey,filters){
  requirePermission_('dashboard.read');
  const d=getActiveDatasetContract_(datasetKey),contract=d.contract,values=d.sheet.getDataRange().getValues();
  const f=filters||{},requestedPeriod=String(f.periode||'').trim(),requestedOffice=String(f.kantor_imigrasi||'').trim();
  if(values.length<2)return {datasetKey,periodGrain:contract.periodGrain,rowCount:0,grandTotal:0,periods:[],offices:[],readOnly:true};
  const header=values[0],hi=Object.fromEntries(header.map((x,n)=>[x,n])),rows=values.slice(1).filter(r=>r.some(v=>String(v)!==''));
  const periodOf_=r=>String(r[hi[contract.periodKey||'periode']]||'').trim(),officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const selected=rows.filter(r=>(!requestedPeriod||periodOf_(r)===requestedPeriod)&&(!requestedOffice||officeOf_(r)===requestedOffice));
  const periods={},offices={},services={};contract.measures.forEach(k=>services[k]=0);
  let grandTotal=0;
  selected.forEach(r=>{
    const period=periodOf_(r),office=officeOf_(r),total=Number(r[hi.total]||0);
    grandTotal+=total;
    if(!periods[period])periods[period]={periode:period,total:0,rowCount:0};
    periods[period].total+=total;periods[period].rowCount++;
    if(!offices[office])offices[office]={kantor_imigrasi:office,total:0,rowCount:0};
    offices[office].total+=total;offices[office].rowCount++;
    contract.measures.forEach(k=>services[k]+=Number(r[hi[k]]||0));
  });
  return {
    datasetKey,
    periodGrain:contract.periodGrain||'month',
    rowCount:selected.length,
    grandTotal,
    periods:Object.values(periods).sort((a,b)=>a.periode.localeCompare(b.periode)),
    offices:Object.values(offices).sort((a,b)=>b.total-a.total),
    services:contract.measures.map(k=>({key:k,total:services[k]})),
    readOnly:true,
    provenance:{datasetKey,periodGrain:contract.periodGrain||'month',sourceMetric:'total'}
  };
}
