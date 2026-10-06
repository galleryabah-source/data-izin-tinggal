/**
 * Passport Year-over-Year Analytics v1.
 * Read-only semantic adapter above PASSPORT_SERVICE_MONTHLY_2025 and PASSPORT_SERVICE_MONTHLY.
 * It never merges or writes canonical datasets.
 */
const PASSPORT_YOY_V1 = Object.freeze({
  contract:'PASSPORT_YOY_ANALYTICS_V1',
  baseYear:'2025',
  compareYear:'2026',
  baseDataset:'PASSPORT_SERVICE_MONTHLY_2025',
  compareDataset:'PASSPORT_SERVICE_MONTHLY',
  serviceMeasures:['m_paspor','walk_in','prioritas','percepatan','eazy','inovasi','bap'],
  totalKeyByDataset:{PASSPORT_SERVICE_MONTHLY_2025:'total_permohonan',PASSPORT_SERVICE_MONTHLY:'total'}
});

function getPassportYearOverYearAnalytics(filters){
  requirePermission_('dashboard.read');
  return getPassportYearOverYearAnalytics_(filters||{});
}

function getPassportYearOverYearAnalytics_(filters){
  const baseYear=String(filters.baseYear||'2025').trim(),compareYear=String(filters.compareYear||'2026').trim();
  if(baseYear!=='2025'||compareYear!=='2026')throw new Error('PASSPORT_YOY_ONLY_2025_VS_2026');
  const base=getPassportYoyDataset_(PASSPORT_YOY_V1.baseDataset),compare=getPassportYoyDataset_(PASSPORT_YOY_V1.compareDataset);
  const basePeriods=Object.keys(base.periods).filter(p=>p.slice(0,4)===baseYear).sort();
  const comparePeriods=Object.keys(compare.periods).filter(p=>p.slice(0,4)===compareYear).sort();
  const commonPeriods=basePeriods.map(p=>p.slice(5)).filter(mm=>comparePeriods.indexOf(compareYear+'-'+mm)>=0).map(mm=>baseYear+'-'+mm);
  const requestedEnd=String(filters.periodEnd||'').trim();
  const endMonth=requestedEnd?String(requestedEnd).slice(0,7).split('-')[1]:'';
  let matchedPeriods=commonPeriods;
  if(endMonth){
    const n=Number(endMonth);
    if(!Number.isInteger(n)||n<1||n>12)throw new Error('PASSPORT_YOY_PERIOD_END_INVALID');
    matchedPeriods=commonPeriods.filter(p=>Number(p.slice(5))<=n);
  }
  if(!matchedPeriods.length)throw new Error('PASSPORT_YOY_NO_MATCHED_PERIODS');
  const compareMatchedPeriods=matchedPeriods.map(p=>compareYear+'-'+p.slice(5));
  const baseAgg=aggregatePassportYoy_(base.rows,matchedPeriods,base.contract);
  const compareAgg=aggregatePassportYoy_(compare.rows,compareMatchedPeriods,compare.contract);
  const baseTotal=baseAgg.total,compareTotal=compareAgg.total;
  const growthPct=baseTotal===0?null:((compareTotal-baseTotal)/baseTotal)*100;
  const baseOffices=Object.keys(baseAgg.offices),compareOffices=Object.keys(compareAgg.offices);
  const comparable=baseOffices.filter(o=>compareOffices.indexOf(o)>=0).sort((a,b)=>a.localeCompare(b,'id'));
  const compareOnly=compareOffices.filter(o=>baseOffices.indexOf(o)<0).sort((a,b)=>a.localeCompare(b,'id'));
  const baseOnly=baseOffices.filter(o=>compareOffices.indexOf(o)<0).sort((a,b)=>a.localeCompare(b,'id'));
  const officeRows=uniqueSortedKeys_(baseOffices.concat(compareOffices)).map(office=>{
    const b=baseAgg.offices[office]||{total:0,rows:0,services:{}},c=compareAgg.offices[office]||{total:0,rows:0,services:{}};
    const isComparable=comparable.indexOf(office)>=0;
    return {
      kantor_imigrasi:office,base2025:b.total,compare2026:c.total,
      delta:c.total-b.total,growthPct:b.total===0?null:((c.total-b.total)/b.total)*100,
      baseRows:b.rows,compareRows:c.rows,
      status:isComparable?'COMPARABLE':(compareOnly.indexOf(office)>=0?'NEW_2026':'ONLY_2025')
    };
  }).sort((a,b)=>b.compare2026-a.compare2026||a.kantor_imigrasi.localeCompare(b.kantor_imigrasi,'id'));
  const monthly=matchedPeriods.map(p=>{
    const cp=compareYear+'-'+p.slice(5),b=baseAgg.periods[p]||{total:0,rows:0},c=compareAgg.periods[cp]||{total:0,rows:0};
    return {periode2025:p,periode2026:cp,base2025:b.total,compare2026:c.total,delta:c.total-b.total,growthPct:b.total===0?null:((c.total-b.total)/b.total)*100,baseRows:b.rows,compareRows:c.rows};
  });
  const services={
    base2025:base.contract.measures.map(key=>({key,total:baseAgg.services[key]||0})),
    compare2026:compare.contract.measures.map(key=>({key,total:compareAgg.services[key]||0}))
  };
  const comparableBase=comparable.reduce((s,o)=>s+(baseAgg.offices[o]?.total||0),0),comparableCompare=comparable.reduce((s,o)=>s+(compareAgg.offices[o]?.total||0),0);
  const newOfficeContribution=compareOnly.reduce((s,o)=>s+(compareAgg.offices[o]?.total||0),0);
  const monthlyGrowth=monthly.filter(x=>x.growthPct!==null);
  const peakGrowth=monthlyGrowth.reduce((best,x)=>!best||x.growthPct>best.growthPct?x:best,null);
  const lowestGrowth=monthlyGrowth.reduce((best,x)=>!best||x.growthPct<best.growthPct?x:best,null);
  const avgBase=matchedPeriods.length?baseTotal/matchedPeriods.length:0,avgCompare=matchedPeriods.length?compareTotal/matchedPeriods.length:0;
  const comparableDelta=comparableCompare-comparableBase;
  const comparableGrowthPct=comparableBase===0?null:(comparableDelta/comparableBase)*100;
  const newOfficeContributionPct=compareTotal===0?null:(newOfficeContribution/compareTotal)*100;
  return {
    contract:PASSPORT_YOY_V1.contract,readOnly:true,measure:'total_permohonan/total',baseYear,compareYear,
    period:{requestedEnd:requestedEnd||compareMatchedPeriods[compareMatchedPeriods.length-1],matchedPeriods,monthCount:matchedPeriods.length,basePeriodsAvailable:basePeriods,comparePeriodsAvailable:comparePeriods},
    datasets:[
      {datasetKey:PASSPORT_YOY_V1.baseDataset,rowCount:base.rows.length,periodCount:basePeriods.length,officeCount:baseOffices.length},
      {datasetKey:PASSPORT_YOY_V1.compareDataset,rowCount:compare.rows.length,periodCount:comparePeriods.length,officeCount:compareOffices.length}
    ],
    totals:{base2025:baseTotal,compare2026:compareTotal,delta:compareTotal-baseTotal,growthPct,avgMonthlyBase2025:avgBase,avgMonthlyCompare2026:avgCompare,comparableOfficeBase2025:comparableBase,comparableOfficeCompare2026:comparableCompare,comparableOfficeDelta:comparableDelta,comparableOfficeGrowthPct:comparableGrowthPct,newOfficeContribution2026:newOfficeContribution,newOfficeContributionPct:newOfficeContributionPct,comparableDeltaContributionPct:(compareTotal-baseTotal)===0?null:(comparableDelta/(compareTotal-baseTotal))*100,newOfficeDeltaContributionPct:(compareTotal-baseTotal)===0?null:(newOfficeContribution/(compareTotal-baseTotal))*100},
    offices:{comparableCount:comparable.length,new2026:compareOnly,only2025:baseOnly,rows:officeRows},
    insights:{peakGrowth,lowestGrowth},
    monthly,services
  };
}

function getPassportYoyDataset_(datasetKey){
  const d=getActiveDatasetContract_(datasetKey),values=d.sheet.getDataRange().getValues();
  if(values.length<2)throw new Error('PASSPORT_YOY_DATASET_EMPTY: '+datasetKey);
  const header=values[0]||[],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const totalKey=PASSPORT_YOY_V1.totalKeyByDataset[datasetKey];
  if(hi.periode===undefined||hi.kantor_imigrasi===undefined||hi[totalKey]===undefined)throw new Error('PASSPORT_YOY_SCHEMA_INVALID: '+datasetKey);
  const rows=values.slice(1).filter(r=>r.some(v=>String(v)!==''));
  const periodOf_=r=>normalizePeriodCell_(r[hi.periode]);
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const periods={};
  rows.forEach(r=>{const p=periodOf_(r);if(p)periods[p]=true;});
  return {contract:d.contract,rows,header,hi,periods:Object.fromEntries(Object.keys(periods).map(p=>[p,true])),officeOf:officeOf_,periodOf:periodOf_};
}

function aggregatePassportYoy_(rows,periods,contract){
  const periodSet={};periods.forEach(p=>periodSet[p]=true);
  const hi=Object.fromEntries((contract.columns||[]).map((x,n)=>[x,n]));
  const out={total:0,periods:{},offices:{},services:{}};
  (contract.measures||[]).forEach(k=>out.services[k]=0);
  rows.forEach(r=>{
    const p=normalizePeriodCell_(r[hi.periode]);if(!periodSet[p])return;
    const office=String(r[hi.kantor_imigrasi]||'').trim();if(!office)return;
    const totalKey=contract.datasetKey==='PASSPORT_SERVICE_MONTHLY_2025'?'total_permohonan':'total';
    const stored=Number(r[hi[totalKey]]);
    const total=Number.isFinite(stored)&&stored>=0?stored:(contract.measures||[]).reduce((s,k)=>s+Number(r[hi[k]]||0),0);
    out.total+=total;
    if(!out.periods[p])out.periods[p]={total:0,rows:0};
    out.periods[p].total+=total;out.periods[p].rows++;
    if(!out.offices[office])out.offices[office]={total:0,rows:0,services:{}};
    out.offices[office].total+=total;out.offices[office].rows++;
    (contract.measures||[]).forEach(k=>{const n=Number(r[hi[k]]||0);out.services[k]+=n;out.offices[office].services[k]=(out.offices[office].services[k]||0)+n;});
  });
  return out;
}
