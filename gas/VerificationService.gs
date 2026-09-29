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
