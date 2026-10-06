/**
 * INTAL TV public read-only adapter.
 *
 * Anonymous viewers may call only these presentation endpoints. The endpoints
 * read the same canonical datasets and registry through private service cores;
 * they never write data, expose users/permissions, or expose raw sheet rows.
 */
function getPublicTvResidenceDashboard(filters){
  return sanitizePublicTvDashboard_(getResidencePermitDashboard_(sanitizePublicTvFilters_(filters)));
}

function getPublicTvPassportDashboard(filters){
  return sanitizePublicTvDashboard_(getServiceDashboard_('PASSPORT_SERVICE_MONTHLY',['biasa_24','biasa_48','elektronik_48','e_polikarbonat'],sanitizePublicTvFilters_(filters)));
}

function getPublicTvResidenceMap(filters){
  return sanitizePublicTvMap_(getServiceMap_('RESIDENCE_PERMIT_SERVICE_MONTHLY',sanitizePublicTvFilters_(filters)));
}

function getPublicTvPassportMap(filters){
  return sanitizePublicTvMap_(getServiceMap_('PASSPORT_SERVICE_MONTHLY',sanitizePublicTvFilters_(filters)));
}

function getPublicTvRunningTexts(){
  return getActiveRunningTexts_();
}

function sanitizePublicTvFilters_(filters){
  const f=filters||{};
  return {
    periode:String(f.periode||'').trim().slice(0,7),
    kantor_imigrasi:String(f.kantor_imigrasi||'').trim().slice(0,200),
    metric:String(f.metric||'total').trim().slice(0,80)
  };
}

function sanitizePublicTvDashboard_(d){
  return {
    datasetKey:String(d.datasetKey||''),
    rowCount:Number(d.rowCount||0),
    metric:String(d.metric||'total'),
    grandTotal:Number(d.grandTotal||0),
    monthly:(d.monthly||[]).map(x=>({periode:String(x.periode||''),total:Number(x.total||0),rows:Number(x.rows||0)})),
    offices:(d.offices||[]).map(x=>({kantor_imigrasi:String(x.kantor_imigrasi||''),total:Number(x.total||0),rows:Number(x.rows||0)})),
    services:(d.services||[]).map(x=>({key:String(x.key||''),total:Number(x.total||0)})),
    filters:{
      periode:String(d.filters?.periode||''),
      kantor_imigrasi:String(d.filters?.kantor_imigrasi||''),
      metric:String(d.filters?.metric||'total'),
      availablePeriods:(d.filters?.availablePeriods||[]).map(String),
      availableOffices:(d.filters?.availableOffices||[]).map(String)
    }
  };
}

function sanitizePublicTvMap_(m){
  return {
    datasetKey:String(m.datasetKey||''),
    rowCount:Number(m.rowCount||0),
    metric:String(m.metric||'total'),
    filters:{
      periode:String(m.filters?.periode||''),
      kantor_imigrasi:String(m.filters?.kantor_imigrasi||''),
      metric:String(m.filters?.metric||'total')
    },
    markers:(m.markers||[]).map(x=>({
      kantor_imigrasi:String(x.kantor_imigrasi||''),
      latitude:Number(x.latitude),
      longitude:Number(x.longitude),
      total:Number(x.total||0),
      metricValue:Number(x.metricValue||0),
      rows:Number(x.rows||0)
    }))
  };
}


/**
 * Public analytical running text for INTAL TV.
 *
 * Builds narratives from the same canonical Phase 10.1 cross-service seam.
 * Output is presentation-only: no raw rows, identities, office reference
 * metadata, or write capability are exposed.
 */
function getPublicTvAnalyticalRunningTexts(){
  const report=getCrossServiceReporting_({});
  const offices=(report.offices||[]).map((x,i)=>({
    rank:i+1,
    kantor_imigrasi:String(x.kantor_imigrasi||''),
    residence:Number(x.residenceTotal||0),
    passport:Number(x.passportTotal||0),
    combined:Number(x.combinedTotal||0),
    residenceRows:Number(x.residenceRows||0),
    passportRows:Number(x.passportRows||0)
  }));
  const monthly=(report.monthly||[]).map(x=>({
    periode:String(x.periode||x.key||''),
    residence:Number(x.residenceTotal||0),
    passport:Number(x.passportTotal||0),
    combined:Number(x.combinedTotal||0)
  })).filter(x=>x.periode).sort((a,b)=>a.periode.localeCompare(b.periode,'id'));
  const total=Number(report.totals?.combined||0);
  const residenceTotal=Number(report.totals?.residence||0);
  const passportTotal=Number(report.totals?.passport||0);
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  const pct=(n,d)=>d?((Number(n||0)/d)*100).toFixed(1).replace('.',',')+'%':'0,0%';
  const signedPct=(n,d)=>d===0?'0,0%':(n>=0?'+':'')+((Number(n||0)/Math.abs(d))*100).toFixed(1).replace('.',',')+'%';
  const monthLabel=p=>{const [y,m]=String(p||'').split('-');const names=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];return names[Math.max(0,Number(m||1)-1)]+' '+y;};
  const avg=values=>values.length?values.reduce((s,n)=>s+Number(n||0),0)/values.length:0;
  const first=monthly[0],last=monthly[monthly.length-1];
  const averageCombined=avg(monthly.map(x=>x.combined));
  const averagePassport=avg(monthly.map(x=>x.passport));
  const averageResidence=avg(monthly.map(x=>x.residence));
  const highest=monthly.reduce((a,b)=>!a||b.combined>a.combined?b:a,null);
  const lowest=monthly.reduce((a,b)=>!a||b.combined<a.combined?b:a,null);
  const trendTexts=monthly.map((x,i)=>{
    if(i===0)return {type:'monthly',periode:x.periode,text:'Tren layanan '+monthLabel(x.periode)+' — total gabungan mencapai '+fmt(x.combined)+' layanan, terdiri dari '+fmt(x.passport)+' layanan Paspor dan '+fmt(x.residence)+' layanan Izin Tinggal. Ini menjadi titik awal pembacaan tren periode berjalan.'};
    const prev=monthly[i-1];
    return {type:'monthly',periode:x.periode,text:'Tren layanan '+monthLabel(x.periode)+' — total gabungan '+fmt(x.combined)+' layanan, berubah '+signedPct(x.combined-prev.combined,prev.combined)+' dibanding '+monthLabel(prev.periode)+' ('+fmt(prev.combined)+' layanan). Paspor tercatat '+fmt(x.passport)+' dan Izin Tinggal '+fmt(x.residence)+'.'};
  });
  const analytical=[...trendTexts];
  if(monthly.length){
    analytical.push({type:'average',text:'Rata-rata keseluruhan per bulan — selama '+fmt(monthly.length)+' periode, rata-rata layanan mencapai '+fmt(Math.round(averageCombined))+' layanan per bulan, terdiri dari rata-rata '+fmt(Math.round(averagePassport))+' layanan Paspor dan '+fmt(Math.round(averageResidence))+' layanan Izin Tinggal. Total kumulatif mencapai '+fmt(total)+' layanan.'});
    analytical.push({type:'trend-summary',text:'Ringkasan tren — periode tertinggi adalah '+monthLabel(highest.periode)+' dengan '+fmt(highest.combined)+' layanan, sedangkan periode terendah adalah '+monthLabel(lowest.periode)+' dengan '+fmt(lowest.combined)+' layanan. Perubahan dari '+monthLabel(first.periode)+' ke '+monthLabel(last.periode)+' adalah '+signedPct(last.combined-first.combined,first.combined)+'.'});
  }
  analytical.push({type:'passport',text:'Analitik layanan Paspor — total '+fmt(passportTotal)+' layanan dengan rata-rata '+fmt(Math.round(averagePassport))+' layanan per bulan. Kontribusi Paspor sebesar '+pct(passportTotal,total)+' dari keseluruhan layanan Paspor dan Izin Tinggal. Pergerakan bulanan dibaca dari dataset PASSPORT_SERVICE_MONTHLY tanpa mengubah data sumber.'});
  analytical.push({type:'residence',text:'Analitik layanan Izin Tinggal — total '+fmt(residenceTotal)+' layanan dengan rata-rata '+fmt(Math.round(averageResidence))+' layanan per bulan. Kontribusi Izin Tinggal sebesar '+pct(residenceTotal,total)+' dari keseluruhan layanan Paspor dan Izin Tinggal. Pergerakan bulanan dibaca dari dataset RESIDENCE_PERMIT_SERVICE_MONTHLY tanpa mengubah data sumber.'});
  analytical.push(...offices.map(o=>({type:'office',rank:o.rank,kantor_imigrasi:o.kantor_imigrasi,text:'Peringkat '+o.rank+' — '+o.kantor_imigrasi+' mencatat '+fmt(o.combined)+' layanan selama '+(monthly.length?monthLabel(first.periode)+'–'+monthLabel(last.periode):'periode tersedia')+', terdiri dari '+fmt(o.passport)+' layanan Paspor dan '+fmt(o.residence)+' layanan Izin Tinggal. Kontribusi kantor ini mencapai '+pct(o.combined,total)+' dari total '+fmt(total)+' layanan Paspor dan Izin Tinggal yang tercatat dalam aplikasi.'})));
  return analytical;
}

/**
 * Public Passport historical context for INTAL TV.
 *
 * Read-only presentation adapter over the already-verified Passport YoY
 * semantic adapter. No canonical dataset, registry, importer, or historical
 * baseline is written or altered here.
 */
function getPublicTvPassportYoYContext(){
  const report=getPassportYearOverYearAnalytics_({baseYear:'2025',compareYear:'2026'});
  return {
    contract:String(report.contract||''),
    readOnly:true,
    baseYear:'2025',
    compareYear:'2026',
    monthCount:Number(report.period?.monthCount||0),
    latestPeriod:String((report.period?.comparePeriodsAvailable||[]).slice(-1)[0]||''),
    base2025:Number(report.totals?.base2025||0),
    compare2026:Number(report.totals?.compare2026||0),
    delta:Number(report.totals?.delta||0),
    growthPct:report.totals?.growthPct===null?null:Number(report.totals?.growthPct),
    comparableOfficeDelta:Number(report.totals?.comparableOfficeDelta||0),
    newOfficeContribution2026:Number(report.totals?.newOfficeContribution2026||0),
    monthly:(report.monthly||[]).map(x=>({
      periode2025:String(x.periode2025||''),
      periode2026:String(x.periode2026||''),
      base2025:Number(x.base2025||0),
      compare2026:Number(x.compare2026||0),
      delta:Number(x.delta||0),
      growthPct:x.growthPct===null?null:Number(x.growthPct)
    })),
    offices:(report.offices?.rows||[]).map(x=>({
      kantor_imigrasi:String(x.kantor_imigrasi||''),
      base2025:Number(x.base2025||0),
      compare2026:Number(x.compare2026||0),
      delta:Number(x.delta||0),
      growthPct:x.growthPct===null?null:Number(x.growthPct),
      status:String(x.status||'')
    })),
    comparableCount:Number(report.offices?.comparableCount||0),
    new2026Count:Number((report.offices?.new2026||[]).length||0)
  };
}


/**
 * Read-only Passport YoY context for one office, used by the existing
 * INTAL TV office detail modal. It reuses the verified semantic adapter and
 * exposes no raw rows or write capability.
 */
function getPublicTvPassportOfficeYoYContext(filters){
  const f=filters||{},office=String(f.kantor_imigrasi||'').trim().slice(0,200);
  if(!office)throw new Error('PASSPORT_YOY_OFFICE_REQUIRED');
  const requestedEnd=String(f.periodEnd||'').trim().slice(0,7);
  const report=getPassportYearOverYearAnalytics_({baseYear:'2025',compareYear:'2026',periodEnd:requestedEnd});
  const row=(report.offices?.rows||[]).find(x=>String(x.kantor_imigrasi||'')===office);
  if(!row)throw new Error('PASSPORT_YOY_OFFICE_NOT_FOUND: '+office);
  const base=getServiceDashboard_('PASSPORT_SERVICE_MONTHLY_2025',['m_paspor','walk_in','prioritas','percepatan','eazy','inovasi','bap'],{kantor_imigrasi:office,metric:'total'},'total_permohonan');
  const compare=getServiceDashboard_('PASSPORT_SERVICE_MONTHLY',['m_paspor','walk_in','prioritas','percepatan','eazy','inovasi','bap'],{kantor_imigrasi:office,metric:'total'},'total');
  const baseByPeriod=Object.fromEntries((base.monthly||[]).map(x=>[String(x.periode||''),Number(x.total||0)]));
  const compareByPeriod=Object.fromEntries((compare.monthly||[]).map(x=>[String(x.periode||''),Number(x.total||0)]));
  const monthly=(report.monthly||[]).map(m=>{
    const p25=String(m.periode2025||''),p26=String(m.periode2026||'');
    const b=Number(baseByPeriod[p25]||0),c=Number(compareByPeriod[p26]||0),delta=c-b;
    return {periode2025:p25,periode2026:p26,base2025:b,compare2026:c,delta,growthPct:b===0?null:(delta/b)*100};
  });
  return {
    contract:String(report.contract||''),readOnly:true,kantor_imigrasi:office,
    baseYear:'2025',compareYear:'2026',status:String(row.status||''),
    monthCount:Number(report.period?.monthCount||0),
    latestPeriod:String((report.period?.comparePeriodsAvailable||[]).slice(-1)[0]||''),
    base2025:Number(row.base2025||0),compare2026:Number(row.compare2026||0),
    delta:Number(row.delta||0),growthPct:row.growthPct===null?null:Number(row.growthPct),
    monthly
  };
}
