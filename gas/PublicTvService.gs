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
/**
 * Public Passport service-level YoY intelligence.
 * Read-only adapter over canonical 2025/2026 monthly datasets.
 * No write capability and no raw-row exposure.
 */
/**
 * Public Passport service intelligence guard.
 *
 * 2026 uses the canonical four-category Passport taxonomy.
 * The 2025 historical dataset uses a different service-measure taxonomy
 * (m_paspor/walk_in/prioritas/percepatan/eazy/inovasi/bap) and its measures
 * are not a proven one-to-one mapping to the 2026 categories. Therefore
 * service-level YoY is intentionally NOT comparable until a governed mapping
 * contract is established. This endpoint exposes the current 2026 composition
 * only and explicitly reports the comparability state.
 */
function getPublicTvPassportServiceYoYContext(){
  const compare=getServiceDashboard_('PASSPORT_SERVICE_MONTHLY',['biasa_24','biasa_48','elektronik_48','e_polikarbonat'],{},'total');
  const labels={elektronik_48:'Elektronik 48',biasa_48:'Biasa 48',e_polikarbonat:'E-Polikarbonat',biasa_24:'Biasa 24'};
  const services=(compare.services||[]).map(x=>({
    key:String(x.key||''),label:String(labels[x.key]||x.key||''),
    base2025:null,compare2026:Number(x.total||0),delta:null,growthPct:null
  })).filter(x=>x.key);
  const totalCompare=Number(compare.grandTotal||0);
  return {
    contract:'PASSPORT_SERVICE_INTELLIGENCE_V1',
    readOnly:true,baseYear:'2025',compareYear:'2026',
    comparisonStatus:'NOT_COMPARABLE',
    comparisonReason:'2025 service taxonomy differs from 2026 canonical service taxonomy; no governed one-to-one mapping has been established.',
    base2025:null,compare2026:totalCompare,delta:null,growthPct:null,services
  };
}


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


/** Read-only GIS reference layer for service points. */
function getPublicTvServicePoints(){
  return {contract:'SERVICE_POINT_REFERENCE_V1',readOnly:true,points:[
    {
      pointId:'DEP-DETOS-001',parentOffice:'KANIM KELAS I NON TPI DEPOK',pointType:'ULP',
      pointTypeLabel:'Unit Layanan Paspor (ULP)',name:'Unit Layanan Paspor Depok Town Square',
      location:'Depok Town Square, Jl. Margonda Raya No.1, Kemiri Muka, Kec. Beji, Kota Depok, Jawa Barat 16424',
      latitude:-6.3725749,longitude:106.8316653,dailyCapacity:45,boothCount:2,
      mapsUrl:'https://maps.app.goo.gl/MXeBHcF6H6r5kMsP9',hours:'—',
      status:'REFERENCE',statusLabel:'REFERENCE · ACTIVE SERVICE POINT',
      coordinateStatus:'VERIFIED_LOCATION',coordinateStatusLabel:'Koordinat lokasi service point terverifikasi; navigasi tetap menggunakan tautan Google Maps'
    },
    {
      pointId:'DEP-PESONA-001',parentOffice:'KANIM KELAS I NON TPI DEPOK',pointType:'IMMIGRATION_LOUNGE',
      pointTypeLabel:'Immigration Lounge / Beranda Imigrasi',name:'Beranda Imigrasi Pesona Square',
      location:'Pesona Square, Lt. 3, Jl. Ir. H. Juanda No.22A, Baktijaya, Kec. Sukmajaya, Kota Depok, Jawa Barat 16418',
      latitude:-6.38023,longitude:106.84431,dailyCapacity:100,boothCount:3,
      mapsUrl:'https://maps.app.goo.gl/iKXGvTAXDnKfovGV8',hours:'10.00–15.30 · jadwal mengikuti layanan',
      status:'REFERENCE',statusLabel:'REFERENCE · ACTIVE SERVICE POINT',
      coordinateStatus:'VERIFIED_LOCATION',coordinateStatusLabel:'Koordinat lokasi service point terverifikasi; navigasi tetap menggunakan tautan Google Maps'
    },
    {
      pointId:'DEP-MPP-001',parentOffice:'KANIM KELAS I NON TPI DEPOK',pointType:'MPP',
      pointTypeLabel:'Mal Pelayanan Publik (MPP)',name:'MPP Kota Depok',
      location:'Gedung Dibaleka / MPP Kota Depok, Kec. Pancoran Mas, Kota Depok, Jawa Barat',
      latitude:-6.394781,longitude:106.820994,dailyCapacity:20,boothCount:1,
      mapsUrl:'https://maps.app.goo.gl/c7cex3475R4AgdRw9',hours:'—',
      status:'REFERENCE',statusLabel:'REFERENCE · ACTIVE SERVICE POINT',
      coordinateStatus:'VERIFIED_LOCATION',coordinateStatusLabel:'Koordinat lokasi service point terverifikasi; navigasi tetap menggunakan tautan Google Maps'
    },
    {
      pointId:'DEP-SAWANGAN-001',parentOffice:'KANIM KELAS I NON TPI DEPOK',pointType:'BRANCH_SERVICE_POINT',
      pointTypeLabel:'Cabang layanan / Beranda Imigrasi',name:'Beranda Imigrasi Sawangan',
      location:'Jl. Raya Parung, Bojongsari Lama, Kec. Bojongsari, Kota Depok, Jawa Barat 16516',
      latitude:-6.4048279,longitude:106.7414554,dailyCapacity:120,boothCount:2,
      mapsUrl:'https://maps.app.goo.gl/sxyHQwNwzs3i75fY8',hours:'Senin–Kamis 08.00–15.00 · Jumat 08.00–15.30',
      status:'REFERENCE',statusLabel:'REFERENCE · PILOT',coordinateStatus:'REFERENCE_NEAR_PUBLIC_ADDRESS',
      coordinateStatusLabel:'Reference point dari area alamat publik; final pin tetap mengikuti tautan Google Maps yang diberikan'
    },
    {
      pointId:'BEK-CIBUBUR-001',parentOffice:'KANIM KELAS I NON TPI BEKASI',pointType:'ULP',
      pointTypeLabel:'Unit Layanan Paspor (ULP)',name:'ULP Plaza Cibubur',
      location:'Plaza Cibubur, Jl. Transyogi, Jatikarya, Kec. Jatisampurna, Kota Bekasi, Jawa Barat 17435',
      latitude:-6.37623,longitude:106.91528,dailyCapacity:50,boothCount:null,
      hours:'Senin–Sabtu · layanan mengikuti jadwal unit',
      status:'REFERENCE',statusLabel:'REFERENCE · ACTIVE SERVICE POINT',
      coordinateStatus:'VERIFIED_LOCATION',coordinateStatusLabel:'Koordinat lokasi service point terverifikasi dari referensi lokasi publik'
    },
    {
      pointId:'BEK-GRANDMETRO-001',parentOffice:'KANIM KELAS I NON TPI BEKASI',pointType:'IMMIGRATION_LOUNGE',
      pointTypeLabel:'Immigration Lounge',name:'Immigration Lounge Grand Metropolitan Mall',
      location:'Grand Metropolitan Mall, Jl. KH. Noer Ali, Pekayon Jaya, Kec. Bekasi Selatan, Kota Bekasi, Jawa Barat 17148',
      latitude:-6.249356,longitude:106.984499,dailyCapacity:null,boothCount:null,
      hours:'Senin–Sabtu · jadwal mengikuti layanan',
      status:'REFERENCE',statusLabel:'REFERENCE · ACTIVE SERVICE POINT',
      coordinateStatus:'VERIFIED_LOCATION',coordinateStatusLabel:'Koordinat lokasi service point terverifikasi dari referensi lokasi publik'
    },
    {
      pointId:'BDG-MIKO-001',parentOffice:'KANIM KELAS I TPI BANDUNG',pointType:'ULP',
      pointTypeLabel:'Unit Layanan Paspor (ULP)',name:'ULP Miko Mall',
      location:'Miko Mall, Jl. Raya Kopo No.599, Cirangrang, Kec. Babakan Ciparay, Kota Bandung, Jawa Barat 40227',
      latitude:-6.9600702,longitude:107.5808048,dailyCapacity:35,boothCount:null,
      hours:'Sabtu · Pasporia by Maung Lembur',
      status:'REFERENCE',statusLabel:'REFERENCE · ACTIVE SERVICE POINT',
      coordinateStatus:'VERIFIED_LOCATION',coordinateStatusLabel:'Koordinat lokasi service point terverifikasi dari referensi lokasi publik'
    }
  ]};
}\n