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
  const total=Number(report.totals?.combined||0);
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  const pct=(n,d)=>d?((Number(n||0)/d)*100).toFixed(1).replace('.',',')+'%':'0,0%';
  return offices.map(o=>({
    rank:o.rank,
    kantor_imigrasi:o.kantor_imigrasi,
    text:'Peringkat '+o.rank+' — '+o.kantor_imigrasi+' mencatat '+fmt(o.combined)+' layanan selama Januari–Agustus 2026, terdiri dari '+fmt(o.passport)+' layanan Paspor dan '+fmt(o.residence)+' layanan Izin Tinggal. Kontribusi kantor ini mencapai '+pct(o.combined,total)+' dari total '+fmt(total)+' layanan Paspor dan Izin Tinggal yang tercatat dalam aplikasi.'
  }));
}
