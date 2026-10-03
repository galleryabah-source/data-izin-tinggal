function verifyDatasetIntegrityV1(datasetKey){
  const user=requirePermission_('audit.read');
  const d=getActiveDatasetContract_(datasetKey);
  const contract=d.contract,expectedColumns=contract.columns.slice(),values=d.sheet.getDataRange().getValues(),header=values[0]||[],periodPattern=contract.periodGrain==='year'?/^[1-9][0-9]{3}$/:/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/;
  const issues=[],hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  if(JSON.stringify(header)!==JSON.stringify(expectedColumns))issues.push('Header dataset tidak identik dengan '+datasetKey+' Contract v'+contract.version+'.');
  expectedColumns.forEach(c=>{if(hi[c]===undefined)issues.push('Kolom contract hilang: '+c+'.');});
  const rows=values.slice(1).filter(r=>r.some(v=>String(v)!==''));
  const seen={},periods={},offices={};
  let duplicateKeys=0,blankKeys=0,invalidPeriods=0,invalidMeasures=0,totalMismatches=0,observedTotal=0;
  rows.forEach(r=>{
    const period=String(r[hi.periode]||'').trim(),office=String(r[hi.kantor_imigrasi]||'').trim();
    if(!period||!office)blankKeys++;
    if(!periodPattern.test(period))invalidPeriods++;
    if(period)periods[period]=true;
    if(office)offices[office]=true;
    const key=period+'|'+office.toUpperCase();
    if(seen[key])duplicateKeys++;
    seen[key]=true;
    let computed=0;
    contract.measures.forEach(column=>{
      const n=Number(r[hi[column]]);
      if(!Number.isInteger(n)||n<0)invalidMeasures++;
      computed+=Number.isFinite(n)?n:0;
    });
    const total=Number(r[hi.total]);
    if(!Number.isInteger(total)||total<0||total!==computed)totalMismatches++;
    observedTotal+=Number.isFinite(total)?total:0;
  });
  if(blankKeys!==0)issues.push('Business key kosong: '+blankKeys+'.');
  if(invalidPeriods!==0)issues.push('Periode tidak canonical YYYY-MM: '+invalidPeriods+'.');
  if(invalidMeasures!==0)issues.push('Measure bukan bilangan bulat >= 0: '+invalidMeasures+'.');
  if(totalMismatches!==0)issues.push('Baris dengan total tidak konsisten: '+totalMismatches+'.');
  if(duplicateKeys!==0)issues.push('Business key duplikat: '+duplicateKeys+'.');
  if(Number(d.registryRow[d.registryIndex.row_count]||0)!==rows.length)issues.push('row_count registry tidak sama dengan jumlah row '+datasetKey+'.');

  const importSheet=getDb_().getSheetByName(SHEETS.IMPORT_LOG),iv=importSheet.getDataRange().getValues(),ih=iv[0]||[],ii=Object.fromEntries(ih.map((x,n)=>[x,n]));
  const imports=iv.slice(1).filter(r=>String(r[ii.dataset_key]||'')===datasetKey),latest=imports.length?imports[imports.length-1]:null;
  let latestBatchId='';
  if(!latest)issues.push('Tidak ditemukan IMPORT_LOG untuk '+datasetKey+'.');
  else{
    latestBatchId=String(latest[ii.batch_id]||'');
    const inputRows=Number(latest[ii.row_count]||0),accepted=Number(latest[ii.accepted]||0),rejected=Number(latest[ii.rejected]||0),duplicates=Number(latest[ii.duplicates]||0);
    if(inputRows<accepted||inputRows!==accepted+rejected)issues.push('IMPORT_LOG accepted + rejected tidak sama dengan row_count input terbaru.');
    if(duplicates>rejected)issues.push('IMPORT_LOG duplicates melebihi rejected pada import terbaru.');
    if(String(latest[ii.status]||'').toUpperCase()!=='SUCCESS')issues.push('IMPORT_LOG status terbaru bukan SUCCESS.');
  }
  const audit=getDb_().getSheetByName(SHEETS.AUDIT_LOG),av=audit.getDataRange().getValues(),ah=av[0]||[],ai=Object.fromEntries(ah.map((x,n)=>[x,n]));
  const matchingAudit=latestBatchId?av.slice(1).filter(r=>String(r[ai.action]||'')==='IMPORT_COMMIT'&&String(r[ai.dataset_key]||'')===datasetKey&&String(r[ai.batch_id]||'')===latestBatchId):[];
  if(!latestBatchId||matchingAudit.length!==1)issues.push('Harus ada tepat 1 AUDIT_LOG IMPORT_COMMIT untuk batch terbaru '+datasetKey+'.');

  const result={
    ok:issues.length===0,verifiedAt:nowIso_(),actor:user.email,datasetKey,sheetName:d.sheetName,
    registryEntries:1,rowCount:rows.length,columnCount:header.length,
    expectedRows:rows.length,expectedColumns:expectedColumns.length,
    periodGrain:contract.periodGrain||'month',periodCount:Object.keys(periods).length,officeCount:Object.keys(offices).length,
    duplicateKeys,blankKeys,invalidPeriods,invalidMeasures,totalMismatches,
    observedTotal,expectedObservedTotal:observedTotal,
    registryRowCount:Number(d.registryRow[d.registryIndex.row_count]||0),
    latestImport:latest?{
      batchId:latestBatchId,rowCount:Number(latest[ii.row_count]||0),
      accepted:Number(latest[ii.accepted]||0),rejected:Number(latest[ii.rejected]||0),
      duplicates:Number(latest[ii.duplicates]||0),status:String(latest[ii.status]||'')
    }:null,
    matchingAuditEvents:matchingAudit.length,issues
  };
  appendAudit_('DATASET_INTEGRITY_VERIFY',datasetKey,latestBatchId,rows.length,result.ok?'SUCCESS':'FAILED',JSON.stringify({
    rowCount:rows.length,observedTotal,periodCount:result.periodCount,officeCount:result.officeCount,
    duplicateKeys,blankKeys,invalidPeriods,invalidMeasures,totalMismatches,issues
  }));
  Logger.log(JSON.stringify(result));
  return result;
}

function verifyRegisteredAnnualDatasetsV1(){
  const user=requirePermission_('audit.read'),registry=getDb_().getSheetByName(SHEETS.DATASET_REGISTRY),values=registry.getDataRange().getValues(),header=values[0]||[],index=Object.fromEntries(header.map((x,n)=>[x,n]));
  const activeKeys=values.slice(1).filter(r=>String(r[index.status]||'').toUpperCase()==='ACTIVE').map(r=>String(r[index.dataset_key]||'').trim()).filter(Boolean);
  const annualKeys=Object.keys(DATASET_CONTRACTS).filter(k=>DATASET_CONTRACTS[k].periodGrain==='year'&&activeKeys.includes(k));
  const datasets=annualKeys.map(datasetKey=>verifyDatasetIntegrityV1(datasetKey));
  return {ok:datasets.every(d=>d.ok),actor:user.email,periodGrain:'year',datasets,checked:annualKeys.length};
}

function verifyResidencePermitMonthlyIntegrity(){
  return verifyDatasetIntegrityV1('RESIDENCE_PERMIT_SERVICE_MONTHLY');
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
  const startedAt=nowIso_(),checks=[];
  const check_=(name,fn)=>{
    try{const result=fn(),ok=Boolean(result&&result.ok!==false);checks.push({name,ok,result});return result;}
    catch(e){checks.push({name,ok:false,error:String(e&&e.message||e)});return null;}
  };
  const registryIntegrity=check_('dataset_registry_identity',()=>verifyDatasetRegistryIntegrityV1());
  const residenceIntegrity=check_('residence_integrity',()=>verifyResidencePermitMonthlyIntegrity());
  const passportIntegrity=check_('passport_integrity',()=>verifyPassportServiceMonthly());
  const annualIntegrity=check_('annual_dataset_integrity',()=>verifyRegisteredAnnualDatasetsV1());
  if(annualIntegrity&&!annualIntegrity.ok)checks[checks.length-1].ok=false;

  const summary=check_('dashboard_summary',()=>getDashboardSummary());
  if(summary){
    const keys=(summary.datasets||[]).map(d=>d.datasetKey);
    if(!keys.includes('RESIDENCE_PERMIT_SERVICE_MONTHLY')||!keys.includes('PASSPORT_SERVICE_MONTHLY'))checks[checks.length-1].ok=false;
  }

  const residenceDashboard=check_('residence_dashboard',()=>getResidencePermitDashboard({}));
  if(residenceDashboard&&residenceIntegrity){
    if(Number(residenceDashboard.rowCount)!==residenceIntegrity.rowCount)checks[checks.length-1].ok=false;
    if(Number(residenceDashboard.grandTotal)!==residenceIntegrity.observedTotal)checks[checks.length-1].ok=false;
    if(residenceDashboard.monthly.length!==residenceIntegrity.periodCount||residenceDashboard.offices.length!==residenceIntegrity.officeCount)checks[checks.length-1].ok=false;
  }

  const passportDashboard=check_('passport_dashboard',()=>getPassportDashboard({}));
  if(passportDashboard&&passportIntegrity){
    if(Number(passportDashboard.rowCount)!==passportIntegrity.rowCount)checks[checks.length-1].ok=false;
    if(Number(passportDashboard.grandTotal)!==passportIntegrity.observedTotal)checks[checks.length-1].ok=false;
    if(passportDashboard.monthly.length!==passportIntegrity.periodCount||passportDashboard.offices.length!==passportIntegrity.officeCount)checks[checks.length-1].ok=false;
  }

  const crossService=check_('cross_service_reporting',()=>getCrossServiceReport({}));
  if(crossService&&residenceIntegrity&&passportIntegrity){
    const residence=crossService.services.find(s=>s.service==='RESIDENCE_PERMIT');
    const passport=crossService.services.find(s=>s.service==='PASSPORT');
    if(!residence||Number(residence.rowCount)!==residenceIntegrity.rowCount||Number(residence.serviceVolume)!==residenceIntegrity.observedTotal||residence.monthly.length!==residenceIntegrity.periodCount||residence.offices.length!==residenceIntegrity.officeCount)checks[checks.length-1].ok=false;
    if(!passport||Number(passport.rowCount)!==passportIntegrity.rowCount||Number(passport.serviceVolume)!==passportIntegrity.observedTotal||passport.monthly.length!==passportIntegrity.periodCount||passport.offices.length!==passportIntegrity.officeCount)checks[checks.length-1].ok=false;
    if(Number(crossService.combinedServiceVolume)!==residenceIntegrity.observedTotal+passportIntegrity.observedTotal)checks[checks.length-1].ok=false;
    const provenance=crossService.provenance||[];
    if(provenance.some(p=>p.sourceMetric!=='total'||p.metric!=='service_volume'))checks[checks.length-1].ok=false;
  }

  const residenceDrilldown=check_('residence_drilldown',()=>getResidencePermitDrilldown({}));
  if(residenceDrilldown&&residenceIntegrity&&Number(residenceDrilldown.totalRows)!==residenceIntegrity.rowCount)checks[checks.length-1].ok=false;

  const passportDrilldown=check_('passport_drilldown',()=>getPassportDrilldown({}));
  if(passportDrilldown&&passportIntegrity){
    if(Number(passportDrilldown.totalRows)!==passportIntegrity.rowCount)checks[checks.length-1].ok=false;
    const periods=passportDrilldown.rows.map(r=>String(r[0]||''));
    if(periods.some(p=>/^\\d{4}-\\d{2}-\\d{2}$/.test(p)))checks[checks.length-1].ok=false;
  }

  const officeStatus=check_('office_reference_readiness',()=>getOfficeReferenceStatus());
  if(officeStatus&&!officeStatus.ready)checks[checks.length-1].ok=false;

  const residenceMap=check_('residence_map',()=>getResidencePermitMap({}));
  if(residenceMap&&residenceIntegrity){
    if(Number(residenceMap.rowCount)!==residenceIntegrity.rowCount||residenceMap.markers.length!==residenceIntegrity.officeCount)checks[checks.length-1].ok=false;
  }

  const passportMap=check_('passport_map',()=>getPassportMap({}));
  if(passportMap&&passportIntegrity){
    if(Number(passportMap.rowCount)!==passportIntegrity.rowCount||passportMap.markers.length!==passportIntegrity.officeCount)checks[checks.length-1].ok=false;
  }

  const failed=checks.filter(c=>!c.ok);
  const result={
    ok:failed.length===0,smokeVersion:'2-growth-safe',verifiedAt:nowIso_(),startedAt,actor:user.email,
    observed:{
      residence:residenceIntegrity?{rowCount:residenceIntegrity.rowCount,grandTotal:residenceIntegrity.observedTotal,monthlyPeriods:residenceIntegrity.periodCount,offices:residenceIntegrity.officeCount}:null,
      passport:passportIntegrity?{rowCount:passportIntegrity.rowCount,grandTotal:passportIntegrity.observedTotal,monthlyPeriods:passportIntegrity.periodCount,offices:passportIntegrity.officeCount}:null
    },
    checks:checks.map(c=>({name:c.name,ok:c.ok,error:c.error||null})),failedChecks:failed.map(c=>c.name)
  };
  const affectedRows=(residenceIntegrity?residenceIntegrity.rowCount:0)+(passportIntegrity?passportIntegrity.rowCount:0);
  appendAudit_('DASHBOARD_REGRESSION_SMOKE','MULTI_DATASET','',affectedRows,result.ok?'PASS':'FAILED',JSON.stringify(result));
  Logger.log(JSON.stringify(result));
  return result;
}

function runProductionSmokeTestV1(){
  const user=requirePermission_('audit.read');
  const startedAt=nowIso_(),checks=[];
  const check_=(name,fn)=>{
    try{const result=fn(),ok=Boolean(result&&result.ok!==false);checks.push({name,ok,result});return result;}
    catch(e){checks.push({name,ok:false,error:String(e&&e.message||e)});return null;}
  };

  const bootstrap=check_('identity',()=>getBootstrap());
  if(!bootstrap||!bootstrap.user||!bootstrap.user.authenticated)checks[checks.length-1].ok=false;

  const registryIntegrity=check_('dataset_registry_identity',()=>verifyDatasetRegistryIntegrityV1());
  const residenceIntegrity=check_('residence_integrity',()=>verifyResidencePermitMonthlyIntegrity());
  const passportIntegrity=check_('passport_integrity',()=>verifyPassportServiceMonthly());

  const summary=check_('dashboard_summary',()=>getDashboardSummary());
  const residenceDashboard=check_('residence_dashboard',()=>getResidencePermitDashboard({}));
  if(residenceDashboard&&residenceIntegrity){
    if(Number(residenceDashboard.rowCount)!==residenceIntegrity.rowCount||Number(residenceDashboard.grandTotal)!==residenceIntegrity.observedTotal||residenceDashboard.monthly.length!==residenceIntegrity.periodCount||residenceDashboard.offices.length!==residenceIntegrity.officeCount)checks[checks.length-1].ok=false;
  }

  const passportDashboard=check_('passport_dashboard',()=>getPassportDashboard({}));
  if(passportDashboard&&passportIntegrity){
    if(Number(passportDashboard.rowCount)!==passportIntegrity.rowCount||Number(passportDashboard.grandTotal)!==passportIntegrity.observedTotal||passportDashboard.monthly.length!==passportIntegrity.periodCount||passportDashboard.offices.length!==passportIntegrity.officeCount)checks[checks.length-1].ok=false;
  }

  const residenceDrilldown=check_('residence_drilldown',()=>getResidencePermitDrilldown({}));
  if(residenceDrilldown&&residenceIntegrity&&Number(residenceDrilldown.totalRows)!==residenceIntegrity.rowCount)checks[checks.length-1].ok=false;

  const passportDrilldown=check_('passport_drilldown',()=>getPassportDrilldown({}));
  if(passportDrilldown&&passportIntegrity&&Number(passportDrilldown.totalRows)!==passportIntegrity.rowCount)checks[checks.length-1].ok=false;

  const officeStatus=check_('office_reference_readiness',()=>getOfficeReferenceStatus());
  if(officeStatus&&!officeStatus.ready)checks[checks.length-1].ok=false;

  const residenceMap=check_('residence_map',()=>getResidencePermitMap({}));
  if(residenceMap&&residenceIntegrity&&(Number(residenceMap.rowCount)!==residenceIntegrity.rowCount||residenceMap.markers.length!==residenceIntegrity.officeCount))checks[checks.length-1].ok=false;

  const passportMap=check_('passport_map',()=>getPassportMap({}));
  if(passportMap&&passportIntegrity&&(Number(passportMap.rowCount)!==passportIntegrity.rowCount||passportMap.markers.length!==passportIntegrity.officeCount))checks[checks.length-1].ok=false;

  const exportCheck=check_('residence_export_verification',()=>verifyResidencePermitExportV1({}));
  if(exportCheck&&!exportCheck.ok)checks[checks.length-1].ok=false;

  const latestSnapshotId=findLatestResidencePermitSnapshot_();
  const snapshot=check_('residence_backup_snapshot',()=>{
    if(!latestSnapshotId)throw new Error('NO_BACKUP_SNAPSHOT_FOUND');
    return verifyResidencePermitSnapshot(latestSnapshotId);
  });
  if(snapshot&&!snapshot.ok)checks[checks.length-1].ok=false;

  const failed=checks.filter(c=>!c.ok);
  const result={
    ok:failed.length===0,smokeVersion:'2-growth-safe',verifiedAt:nowIso_(),startedAt,actor:user.email,
    deploymentId:APP.DEPLOYMENT_ID,releaseEvidenceVersion:APP.RELEASE_EVIDENCE_VERSION,
    observed:{
      residence:residenceIntegrity?{rowCount:residenceIntegrity.rowCount,grandTotal:residenceIntegrity.observedTotal,monthlyPeriods:residenceIntegrity.periodCount,offices:residenceIntegrity.officeCount}:null,
      passport:passportIntegrity?{rowCount:passportIntegrity.rowCount,grandTotal:passportIntegrity.observedTotal,monthlyPeriods:passportIntegrity.periodCount,offices:passportIntegrity.officeCount}:null
    },
    latestSnapshotId:latestSnapshotId||null,
    checks:checks.map(c=>({name:c.name,ok:c.ok,error:c.error||null})),failedChecks:failed.map(c=>c.name)
  };
  const affectedRows=(residenceIntegrity?residenceIntegrity.rowCount:0)+(passportIntegrity?passportIntegrity.rowCount:0);
  appendAudit_('PRODUCTION_SMOKE_TEST','MULTI_DATASET','',affectedRows,result.ok?'PASS':'FAILED',JSON.stringify(result));
  Logger.log(JSON.stringify(result));
  return result;
}