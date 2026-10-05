function getProductionEvidenceCenterV1(){
  const user=requirePermission_('audit.read');
  const health=getDatasetHealthCenterV1();
  const audit=getDb_().getSheetByName(SHEETS.AUDIT_LOG);
  const values=audit?audit.getDataRange().getValues():[];
  const header=values[0]||[];
  const index=Object.fromEntries(header.map((x,n)=>[String(x),n]));
  const latestAction=action=>{
    for(let n=values.length-1;n>=1;n--){
      const row=values[n];
      if(String(row[index.action]||'')!==action)continue;
      return {
        timestamp:String(row[index.timestamp]||''),
        actor:String(row[index.actor]||''),
        datasetKey:String(row[index.dataset_key]||''),
        batchId:String(row[index.batch_id]||''),
        status:String(row[index.status]||''),
        details:String(row[index.details]||'')
      };
    }
    return null;
  };
  const deploymentId=String(APP.DEPLOYMENT_ID||'').trim();
  const datasets=(health.datasets||[]).map(d=>({
    datasetKey:d.datasetKey,
    rowCount:d.rowCount,
    periodRange:d.periodRange,
    officeCount:d.officeCount,
    grandTotal:d.grandTotal,
    latestImport:d.latestImport,
    latestVerification:d.latestVerification,
    snapshot:{
      fresh:Boolean(d.snapshot&&d.snapshot.fresh),
      manifestStatus:d.snapshot&&d.snapshot.manifestStatus||'',
      name:d.snapshot&&d.snapshot.name||'',
      spreadsheetId:d.snapshot&&d.snapshot.spreadsheetId||''
    },
    ok:d.ok===true
  }));
  const productionSmoke=latestAction('PRODUCTION_SMOKE_TEST');
  const regressionSmoke=latestAction('DASHBOARD_REGRESSION_SMOKE');
  const backupResidence=latestAction('BACKUP_SNAPSHOT_VERIFY');
  const backupPassport=latestAction('BACKUP_SNAPSHOT_VERIFY');
  const latestSmokeStatus=productionSmoke?String(productionSmoke.status||'').toUpperCase():'';
  return {
    ok:health.ok===true&&Boolean(deploymentId)&&(!productionSmoke||latestSmokeStatus==='PASS'),
    verifiedAt:nowIso_(),
    actor:user.email,
    releaseEvidenceVersion:String(APP.RELEASE_EVIDENCE_VERSION||''),
    appVersion:String(APP.VERSION||''),
    deploymentId,
    datasets,
    evidence:{
      productionSmoke,
      dashboardRegressionSmoke:regressionSmoke,
      latestBackupVerification:backupResidence||backupPassport
    }
  };
}