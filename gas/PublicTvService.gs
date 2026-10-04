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
