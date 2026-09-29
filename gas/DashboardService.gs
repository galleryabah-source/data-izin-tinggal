function getDashboardSummary(){
  requirePermission_('dashboard.read');const datasets=listDatasets();let total=0;datasets.forEach(d=>total+=d.rowCount);
  return {totalRecords:total,datasets:datasets.map(d=>({datasetKey:d.datasetKey,rowCount:d.rowCount,columns:d.columns}))};
}
