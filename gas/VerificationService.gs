function verifyResidencePermitMonthlyIntegrity(){
  const user=requirePermission_('audit.read');
  const ss=getDb_();
  const datasetKey='RESIDENCE_PERMIT_SERVICE_MONTHLY';
  const expectedColumns=DATASET_CONTRACTS[datasetKey].columns.slice();
  const registry=ss.getSheetByName(SHEETS.DATASET_REGISTRY);
  const datasetRows=registry.getDataRange().getValues();
  const rh=datasetRows[0]||[];
  const ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
  const active=datasetRows.slice(1).filter(r=>String(r[ri.dataset_key]||'')===datasetKey&&String(r[ri.status]||'').toUpperCase()==='ACTIVE');
  const issues=[];
  if(active.length!==1)issues.push('DATASET_REGISTRY harus memiliki tepat 1 entry ACTIVE untuk '+datasetKey+'.');
  const reg=active[0]||null;
  const sheetName=reg?String(reg[ri.sheet_name]||''):APP.SHEET_PREFIX+datasetKey;
  const sh=ss.getSheetByName(sheetName);
  if(!sh)issues.push('Dataset sheet tidak ditemukan: '+sheetName);
  let rowCount=0, columnCount=0, duplicateKeys=0, totalMismatches=0, blankKeys=0;
  let observedTotal=0;
  if(sh){
    const values=sh.getDataRange().getValues();
    const header=values[0]||[];
    columnCount=header.length;
    if(JSON.stringify(header)!==JSON.stringify(expectedColumns))issues.push('Header dataset tidak identik dengan Data Contract v1.');
    const hi=Object.fromEntries(header.map((x,n)=>[x,n]));
    const requiredIndexes=expectedColumns.map(c=>hi[c]);
    if(requiredIndexes.some(i=>i===undefined))issues.push('Ada kolom contract yang hilang dari dataset sheet.');
    const seen={};
    values.slice(1).forEach(r=>{
      if(r.length===0||r.every(v=>String(v)===''))return;
      rowCount++;
      const period=String(r[hi.periode]||'').trim();
      const office=String(r[hi.kantor_imigrasi]||'').trim();
      if(!period||!office)blankKeys++;
      const key=period+'|'+office.toUpperCase();
      if(seen[key])duplicateKeys++;
      seen[key]=true;
      const metricColumns=['bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim'];
      const computed=metricColumns.reduce((sum,c)=>sum+Number(r[hi[c]]||0),0);
      if(Number(r[hi.total])!==computed)totalMismatches++;
      observedTotal+=Number(r[hi.total]||0);
    });
  }
  if(rowCount!==80)issues.push('Jumlah row dataset harus 80, ditemukan '+rowCount+'.');
  if(columnCount!==expectedColumns.length)issues.push('Jumlah kolom dataset harus '+expectedColumns.length+', ditemukan '+columnCount+'.');
  if(duplicateKeys!==0)issues.push('Business key duplikat: '+duplicateKeys+'.');
  if(blankKeys!==0)issues.push('Business key kosong: '+blankKeys+'.');
  if(totalMismatches!==0)issues.push('Baris dengan total tidak konsisten: '+totalMismatches+'.');
  if(reg&&Number(reg[ri.row_count]||0)!==rowCount)issues.push('row_count registry tidak sama dengan jumlah row dataset.');

  const importLog=ss.getSheetByName(SHEETS.IMPORT_LOG);
  const iv=importLog.getDataRange().getValues();
  const ih=iv[0]||[];
  const ii=Object.fromEntries(ih.map((x,n)=>[x,n]));
  const imports=iv.slice(1).filter(r=>String(r[ii.dataset_key]||'')===datasetKey);
  const latestImport=imports.length?imports[imports.length-1]:null;
  const latestBatchId=latestImport?String(latestImport[ii.batch_id]||''):'';
  if(!latestImport)issues.push('Tidak ditemukan IMPORT_LOG untuk dataset.');
  else{
    if(Number(latestImport[ii.accepted]||0)!==80)issues.push('IMPORT_LOG accepted terbaru bukan 80.');
    if(Number(latestImport[ii.rejected]||0)!==0)issues.push('IMPORT_LOG rejected terbaru bukan 0.');
    if(Number(latestImport[ii.duplicates]||0)!==0)issues.push('IMPORT_LOG duplicates terbaru bukan 0.');
    if(String(latestImport[ii.status]||'').toUpperCase()!=='SUCCESS')issues.push('IMPORT_LOG status terbaru bukan SUCCESS.');
    if(Number(latestImport[ii.row_count]||0)!==80)issues.push('IMPORT_LOG row_count terbaru bukan 80.');
  }

  const audit=ss.getSheetByName(SHEETS.AUDIT_LOG);
  const av=audit.getDataRange().getValues();
  const ah=av[0]||[];
  const ai=Object.fromEntries(ah.map((x,n)=>[x,n]));
  const matchingAudit=av.slice(1).filter(r=>String(r[ai.action]||'')==='IMPORT_COMMIT'&&String(r[ai.dataset_key]||'')===datasetKey&&String(r[ai.batch_id]||'')===latestBatchId);
  if(!latestBatchId||matchingAudit.length!==1)issues.push('Harus ada tepat 1 AUDIT_LOG IMPORT_COMMIT yang cocok dengan batch terbaru.');

  const result={
    ok:issues.length===0,
    verifiedAt:nowIso_(),
    actor:user.email,
    datasetKey,
    sheetName,
    registryEntries:active.length,
    rowCount,
    columnCount,
    expectedRows:80,
    expectedColumns:expectedColumns.length,
    duplicateKeys,
    blankKeys,
    totalMismatches,
    observedTotal,
    expectedObservedTotal:258094,
    registryRowCount:reg?Number(reg[ri.row_count]||0):null,
    latestImport:latestImport?{
      batchId:latestBatchId,
      rowCount:Number(latestImport[ii.row_count]||0),
      accepted:Number(latestImport[ii.accepted]||0),
      rejected:Number(latestImport[ii.rejected]||0),
      duplicates:Number(latestImport[ii.duplicates]||0),
      status:String(latestImport[ii.status]||'')
    }:null,
    matchingAuditEvents:matchingAudit.length,
    issues
  };
  if(observedTotal!==258094)result.issues.push('Aggregate total berbeda dari fixture tervalidasi: expected 258094, observed '+observedTotal+'.');
  result.ok=result.issues.length===0;
  Logger.log(JSON.stringify(result));
  return result;
}


function verifyResidencePermitExportV1(filters){
  const user=requirePermission_('audit.read');
  requirePermission_('dataset.export');
  const datasetKey='RESIDENCE_PERMIT_SERVICE_MONTHLY';
  const ss=getDb_();
  const registry=ss.getSheetByName(SHEETS.DATASET_REGISTRY);
  const rv=registry.getDataRange().getValues(),rh=rv[0]||[],ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
  const reg=rv.slice(1).find(r=>String(r[ri.dataset_key]||'')===datasetKey&&String(r[ri.status]||'').toUpperCase()==='ACTIVE');
  if(!reg)throw new Error('DATASET_NOT_REGISTERED');
  const sheetName=String(reg[ri.sheet_name]||APP.SHEET_PREFIX+datasetKey);
  const sh=ss.getSheetByName(sheetName);
  if(!sh)throw new Error('DATASET_SHEET_NOT_FOUND: '+sheetName);
  const values=sh.getDataRange().getValues();
  if(values.length<2)throw new Error('DATASET_EMPTY');
  const header=values[0];
  const hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const requestedPeriod=String((filters&&filters.periode)||'').trim();
  const requestedOffice=String((filters&&filters.kantor_imigrasi)||'').trim();
  const periodOf_=r=>{
    const raw=r[hi.periode];
    return raw instanceof Date ? Utilities.formatDate(raw,APP.TZ,'yyyy-MM') : String(raw||'').trim();
  };
  const officeOf_=r=>String(r[hi.kantor_imigrasi]||'').trim();
  const expectedRows=values.slice(1).filter(r=>r.some(v=>String(v)!=='')).filter(r=>
    (!requestedPeriod||periodOf_(r)===requestedPeriod)&&
    (!requestedOffice||officeOf_(r)===requestedOffice)
  );
  const exported=exportResidencePermitMonthly(filters);
  const lines=String(exported.content||'').split('\n');
  const parseCsvLine_=line=>{
    const out=[],re=/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g;
    let m;
    while((m=re.exec(line))!==null){
      let value=m[1]||'';
      if(value.charAt(0)==='"'&&value.charAt(value.length-1)==='"')value=value.slice(1,-1).replace(/""/g,'"');
      out.push(value);
      if(m.index+m[0].length>=line.length)break;
    }
    return out;
  };
  const exportedHeader=parseCsvLine_(lines[0]||'');
  const exportedRows=lines.slice(1).filter(line=>line!=='').map(parseCsvLine_);
  const issues=[];
  if(JSON.stringify(exportedHeader)!==JSON.stringify(header))issues.push('CSV header berbeda dari dataset header.');
  if(exportedRows.length!==expectedRows.length)issues.push('CSV row count '+exportedRows.length+' berbeda dari expected '+expectedRows.length+'.');
  if(Number(exported.rowCount)!==expectedRows.length)issues.push('Export response rowCount berbeda dari expected.');
  const businessKeys={};
  let valueMismatches=0,totalExported=0,totalExpected=0;
  expectedRows.forEach((row,rowIndex)=>{
    const csvRow=exportedRows[rowIndex];
    if(!csvRow){return;}
    header.forEach((column,index)=>{
      let expected=row[index];
      if(expected instanceof Date)expected=Utilities.formatDate(expected,APP.TZ,'yyyy-MM');
      const actual=csvRow[index];
      const expectedText=String(expected===null||expected===undefined?'':expected);
      if(actual!==expectedText)valueMismatches++;
    });
    const key=periodOf_(row)+'|'+officeOf_(row).toUpperCase();
    businessKeys[key]=(businessKeys[key]||0)+1;
    totalExpected+=Number(row[hi.total]||0);
    totalExported+=Number(csvRow[hi.total]||0);
  });
  const duplicateExportKeys=Object.values(businessKeys).filter(n=>n>1).length;
  if(valueMismatches!==0)issues.push('CSV value mismatches: '+valueMismatches+'.');
  if(duplicateExportKeys!==0)issues.push('CSV duplicate business keys: '+duplicateExportKeys+'.');
  if(totalExported!==totalExpected)issues.push('CSV aggregate total '+totalExported+' berbeda dari expected '+totalExpected+'.');
  const result={
    ok:issues.length===0,
    verifiedAt:nowIso_(),
    actor:user.email,
    datasetKey,
    filters:{periode:requestedPeriod,kantor_imigrasi:requestedOffice},
    expectedRows:expectedRows.length,
    exportedRows:exportedRows.length,
    expectedTotal:totalExpected,
    exportedTotal:totalExported,
    valueMismatches,
    duplicateExportKeys,
    filename:exported.filename,
    issues
  };
  Logger.log(JSON.stringify(result));
  return result;
}


function findLatestResidencePermitSnapshot_(){
  const cfg=backupConfig_();
  if(!cfg.folderId)return '';
  const folder=DriveApp.getFolderById(cfg.folderId);
  const files=folder.getFiles();
  let latest=null;
  while(files.hasNext()){
    const file=files.next();
    const name=file.getName();
    if(name.indexOf('BACKUP_RESIDENCE_PERMIT_SERVICE_MONTHLY_')!==0)continue;
    if(!latest||file.getLastUpdated().getTime()>latest.getLastUpdated().getTime())latest=file;
  }
  return latest?latest.getId():'';
}


function runDashboardRegressionSmokeV1(){
  const user=requirePermission_('audit.read');
  const startedAt=nowIso_();
  const checks=[];
  const check_=(name,fn)=>{
    try{
      const result=fn();
      const ok=Boolean(result&&result.ok!==false);
      checks.push({name,ok,result});
      return result;
    }catch(e){
      checks.push({name,ok:false,error:String(e&&e.message||e)});
      return null;
    }
  };

  const registryIntegrity=check_('dataset_registry_identity',()=>verifyDatasetRegistryIntegrityV1());
  if(registryIntegrity&&!registryIntegrity.ok)checks[checks.length-1].ok=false;

  const summary=check_('dashboard_summary',()=>getDashboardSummary());
  if(summary){
    const keys=(summary.datasets||[]).map(d=>d.datasetKey);
    if(!keys.includes('RESIDENCE_PERMIT_SERVICE_MONTHLY')||!keys.includes('PASSPORT_SERVICE_MONTHLY'))checks[checks.length-1].ok=false;
  }

  const residenceDashboard=check_('residence_dashboard',()=>getResidencePermitDashboard({}));
  if(residenceDashboard){
    if(Number(residenceDashboard.rowCount)!==80||Number(residenceDashboard.grandTotal)!==258094||residenceDashboard.monthly.length!==8||residenceDashboard.offices.length!==10)checks[checks.length-1].ok=false;
  }

  const crossService=check_('cross_service_reporting',()=>getCrossServiceReport({}));
  if(crossService){
    const residence=crossService.services.find(s=>s.service==='RESIDENCE_PERMIT');
    const passport=crossService.services.find(s=>s.service==='PASSPORT');
    if(!residence||Number(residence.rowCount)!==80||Number(residence.serviceVolume)!==258094||residence.monthly.length!==8||residence.offices.length!==10)checks[checks.length-1].ok=false;
    if(!passport||Number(passport.rowCount)!==80||Number(passport.serviceVolume)!==327088||passport.monthly.length!==8||passport.offices.length!==10)checks[checks.length-1].ok=false;
    if(Number(crossService.combinedServiceVolume)!==585182)checks[checks.length-1].ok=false;
    const provenance=crossService.provenance||[];
    if(provenance.some(p=>p.sourceMetric!=='total'||p.metric!=='service_volume'))checks[checks.length-1].ok=false;
  }

  const passportDashboard=check_('passport_dashboard',()=>getPassportDashboard({}));
  if(passportDashboard){
    if(Number(passportDashboard.rowCount)!==80||Number(passportDashboard.grandTotal)!==327088||passportDashboard.monthly.length!==8||passportDashboard.offices.length!==10)checks[checks.length-1].ok=false;
  }

  const residenceDrilldown=check_('residence_drilldown',()=>getResidencePermitDrilldown({}));
  if(residenceDrilldown&&Number(residenceDrilldown.totalRows)!==80)checks[checks.length-1].ok=false;

  const passportDrilldown=check_('passport_drilldown',()=>getPassportDrilldown({}));
  if(passportDrilldown){
    if(Number(passportDrilldown.totalRows)!==80)checks[checks.length-1].ok=false;
    const periods=passportDrilldown.rows.map(r=>String(r[0]||''));
    if(periods.some(p=>/^\\d{4}-\\d{2}-\\d{2}$/.test(p)))checks[checks.length-1].ok=false;
  }

  const officeStatus=check_('office_reference_readiness',()=>getOfficeReferenceStatus());
  if(officeStatus&&!officeStatus.ready)checks[checks.length-1].ok=false;

  const residenceMap=check_('residence_map',()=>getResidencePermitMap({}));
  if(residenceMap&&(Number(residenceMap.rowCount)!==80||residenceMap.markers.length!==10))checks[checks.length-1].ok=false;

  const passportMap=check_('passport_map',()=>getPassportMap({}));
  if(passportMap&&(Number(passportMap.rowCount)!==80||passportMap.markers.length!==10))checks[checks.length-1].ok=false;

  const failed=checks.filter(c=>!c.ok);
  const result={
    ok:failed.length===0,
    smokeVersion:'1',
    verifiedAt:nowIso_(),
    startedAt,
    actor:user.email,
    expected:{
      residence:{rowCount:80,grandTotal:258094,monthlyPeriods:8,offices:10},
      passport:{rowCount:80,grandTotal:327088,monthlyPeriods:8,offices:10}
    },
    checks:checks.map(c=>({name:c.name,ok:c.ok,error:c.error||null})),
    failedChecks:failed.map(c=>c.name)
  };
  appendAudit_('DASHBOARD_REGRESSION_SMOKE','MULTI_DATASET','',160,result.ok?'PASS':'FAILED',JSON.stringify(result));
  Logger.log(JSON.stringify(result));
  return result;
}


function runProductionSmokeTestV1(){
  const user=requirePermission_('audit.read');
  const startedAt=nowIso_();
  const checks=[];
  const check_=(name,fn)=>{
    try{
      const result=fn();
      const ok=Boolean(result&&result.ok!==false);
      checks.push({name,ok,result});
      return result;
    }catch(e){
      checks.push({name,ok:false,error:String(e&&e.message||e)});
      return null;
    }
  };

  const bootstrap=check_('identity',()=>getBootstrap());
  if(!bootstrap||!bootstrap.user||!bootstrap.user.authenticated)checks[checks.length-1].ok=false;

  const registryIntegrity=check_('dataset_registry_identity',()=>verifyDatasetRegistryIntegrityV1());
  if(registryIntegrity&&!registryIntegrity.ok)checks[checks.length-1].ok=false;

  const summary=check_('dashboard_summary',()=>getDashboardSummary());
  const dashboard=check_('dashboard_baseline',()=>getResidencePermitDashboard({}));
  if(dashboard){
    if(Number(dashboard.rowCount)!==80)checks[checks.length-1].ok=false;
    if(Number(dashboard.grandTotal)!==258094)checks[checks.length-1].ok=false;
    if(!Array.isArray(dashboard.monthly)||dashboard.monthly.length!==8)checks[checks.length-1].ok=false;
    if(!Array.isArray(dashboard.offices)||dashboard.offices.length!==10)checks[checks.length-1].ok=false;
  }

  const drilldown=check_('drilldown_baseline',()=>getResidencePermitDrilldown({}));
  if(drilldown&&Number(drilldown.totalRows)!==80)checks[checks.length-1].ok=false;

  const officeStatus=check_('office_reference_readiness',()=>getOfficeReferenceStatus());
  if(officeStatus&&!officeStatus.ready)checks[checks.length-1].ok=false;

  const map=check_('map_baseline',()=>getResidencePermitMap({}));
  if(map){
    if(Number(map.rowCount)!==80)checks[checks.length-1].ok=false;
    if(!Array.isArray(map.markers)||map.markers.length!==10)checks[checks.length-1].ok=false;
  }

  const integrity=check_('dataset_integrity',()=>verifyResidencePermitMonthlyIntegrity());
  if(integrity&&!integrity.ok)checks[checks.length-1].ok=false;

  const exportCheck=check_('export_verification',()=>verifyResidencePermitExportV1({}));
  if(exportCheck&&!exportCheck.ok)checks[checks.length-1].ok=false;

  const latestSnapshotId=findLatestResidencePermitSnapshot_();
  const snapshot=check_('backup_snapshot',()=>{
    if(!latestSnapshotId)throw new Error('NO_BACKUP_SNAPSHOT_FOUND');
    return verifyResidencePermitSnapshot(latestSnapshotId);
  });
  if(snapshot&&!snapshot.ok)checks[checks.length-1].ok=false;

  const failed=checks.filter(c=>!c.ok);
  const result={
    ok:failed.length===0,
    smokeVersion:'1',
    verifiedAt:nowIso_(),
    startedAt,
    actor:user.email,
    datasetKey:'RESIDENCE_PERMIT_SERVICE_MONTHLY',
    deploymentId:APP.DEPLOYMENT_ID,
    releaseEvidenceVersion:APP.RELEASE_EVIDENCE_VERSION,
    expected:{rowCount:80,grandTotal:258094,monthlyPeriods:8,offices:10},
    latestSnapshotId:latestSnapshotId||null,
    checks:checks.map(c=>({name:c.name,ok:c.ok,error:c.error||null})),
    failedChecks:failed.map(c=>c.name)
  };
  appendAudit_('PRODUCTION_SMOKE_TEST','RESIDENCE_PERMIT_SERVICE_MONTHLY','',80,result.ok?'PASS':'FAILED',JSON.stringify(result));
  Logger.log(JSON.stringify(result));
  return result;
}
