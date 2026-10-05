function getBackupRecoveryCenterV1(){
  const user=requirePermission_('audit.read');
  const health=getDatasetHealthCenterV1();
  const datasets=(health.datasets||[]).map(d=>({
    datasetKey:d.datasetKey,
    rowCount:d.rowCount,
    periodRange:d.periodRange,
    snapshot:{
      configured:Boolean(d.snapshot&&d.snapshot.configured),
      fresh:Boolean(d.snapshot&&d.snapshot.fresh),
      name:d.snapshot&&d.snapshot.name||'',
      spreadsheetId:d.snapshot&&d.snapshot.spreadsheetId||'',
      rowCount:Number(d.snapshot&&d.snapshot.rowCount||0),
      manifestStatus:d.snapshot&&d.snapshot.manifestStatus||'',
      lastUpdated:d.snapshot&&d.snapshot.lastUpdated||''
    }
  }));
  return {
    ok:health.ok===true && datasets.every(d=>d.snapshot.configured&&d.snapshot.fresh&&d.snapshot.manifestStatus==='COMPLETE'),
    verifiedAt:nowIso_(),
    actor:user.email,
    restoreEnabled:false,
    restorePolicy:'RESTORE_DISABLED_P0_3_READ_ONLY',
    backupFolderConfigured:datasets.some(d=>d.snapshot.configured),
    datasets
  };
}

function verifyBackupRecoverySnapshotV1(datasetKey,snapshotSpreadsheetId){
  requirePermission_('audit.read');
  const key=String(datasetKey||'').trim();
  const id=String(snapshotSpreadsheetId||'').trim();
  if(key==='RESIDENCE_PERMIT_SERVICE_MONTHLY')return verifyResidencePermitSnapshot(id);
  if(key==='PASSPORT_SERVICE_MONTHLY')return verifyPassportServiceSnapshot(id);
  throw new Error('UNSUPPORTED_BACKUP_DATASET: '+key);
}
