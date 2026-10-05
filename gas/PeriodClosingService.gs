function ensurePeriodClosureSheet_(){
  const ss=getDb_();
  let sh=ss.getSheetByName(SHEETS.PERIOD_CLOSURES);
  const headers=['closure_id','dataset_key','periode','status','closed_by','closed_at','reason','reopened_by','reopened_at'];
  if(!sh)sh=ss.insertSheet(SHEETS.PERIOD_CLOSURES);
  if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}

function getPeriodClosureRows_(){
  const sh=ensurePeriodClosureSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2)return [];
  const h=v[0],i=Object.fromEntries(h.map((x,n)=>[x,n]));
  return v.slice(1).filter(r=>String(r[i.closure_id]||'').trim()).map(r=>({
    closureId:String(r[i.closure_id]||''),
    datasetKey:String(r[i.dataset_key]||''),
    periode:String(r[i.periode]||''),
    status:String(r[i.status]||'OPEN').toUpperCase(),
    closedBy:String(r[i.closed_by]||''),
    closedAt:String(r[i.closed_at]||''),
    reason:String(r[i.reason]||''),
    reopenedBy:String(r[i.reopened_by]||''),
    reopenedAt:String(r[i.reopened_at]||'')
  }));
}

function getClosedPeriods_(datasetKey){
  return getPeriodClosureRows_().filter(x=>x.datasetKey===datasetKey&&x.status==='CLOSED').map(x=>x.periode);
}

function assertPeriodsOpenForImport_(datasetKey,rows){
  const periods=[...new Set((rows||[]).map(r=>String(r[0]||'').trim()).filter(Boolean))];
  const closed=new Set(getClosedPeriods_(datasetKey));
  const blocked=periods.filter(p=>closed.has(p));
  if(blocked.length)throw new Error('PERIOD_CLOSED: '+datasetKey+' '+blocked.join(', ')+'. Gunakan controlled correction dengan membuka periode secara resmi.');
  return true;
}

function listPeriodClosures(){
  requirePermission_('audit.read');
  return getPeriodClosureRows_().sort((a,b)=>a.datasetKey.localeCompare(b.datasetKey)||a.periode.localeCompare(b.periode));
}

function closePeriod(datasetKey,periode,reason){
  const user=requirePermission_('admin.config');
  const key=String(datasetKey||'').trim(),period=String(periode||'').trim(),why=String(reason||'').trim();
  if(!DATASET_CONTRACTS[key])throw new Error('DATASET_CONTRACT_NOT_FOUND: '+key);
  if(!/^\\d{4}-\\d{2}$/.test(period))throw new Error('Periode harus YYYY-MM.');
  if(!why)throw new Error('Alasan closing wajib diisi.');
  const existing=getPeriodClosureRows_().find(x=>x.datasetKey===key&&x.periode===period);
  if(existing&&existing.status==='CLOSED')return {ok:true,alreadyClosed:true,closureId:existing.closureId,datasetKey:key,periode:period};
  const dashboard=key==='RESIDENCE_PERMIT_SERVICE_MONTHLY'
    ?getResidencePermitDashboard_({periode:period,metric:'total'})
    :getServiceDashboard_(key,DATASET_CONTRACTS[key].measures,{periode:period,metric:'total'});
  if(!Number(dashboard.rowCount||0))throw new Error('PERIOD_EMPTY: tidak ada data untuk periode '+period+'.');
  const sh=ensurePeriodClosureSheet_(),now=nowIso_(),id=existing?existing.closureId:Utilities.getUuid();
  if(existing){
    const v=sh.getDataRange().getValues(),h=v[0],i=Object.fromEntries(h.map((x,n)=>[x,n]));
    const row=v.findIndex(r=>String(r[i.closure_id]||'')===id)+1;
    sh.getRange(row,i.status+1,1,6).setValues([['CLOSED',user.email,now,why,'','']]);
  }else{
    sh.appendRow([id,key,period,'CLOSED',user.email,now,why,'','']);
  }
  appendAudit_('PERIOD_CLOSE',key,id,Number(dashboard.rowCount||0),'SUCCESS',JSON.stringify({periode:period,reason:why,grandTotal:Number(dashboard.grandTotal||0)}));
  return {ok:true,closureId:id,datasetKey:key,periode:period,status:'CLOSED',rowCount:Number(dashboard.rowCount||0),grandTotal:Number(dashboard.grandTotal||0)};
}

function reopenPeriod(datasetKey,periode,reason){
  const user=requirePermission_('admin.config');
  const key=String(datasetKey||'').trim(),period=String(periode||'').trim(),why=String(reason||'').trim();
  if(!DATASET_CONTRACTS[key])throw new Error('DATASET_CONTRACT_NOT_FOUND: '+key);
  if(!/^\\d{4}-\\d{2}$/.test(period))throw new Error('Periode harus YYYY-MM.');
  if(!why)throw new Error('Alasan controlled correction wajib diisi.');
  const sh=ensurePeriodClosureSheet_(),v=sh.getDataRange().getValues(),h=v[0],i=Object.fromEntries(h.map((x,n)=>[x,n]));
  const rowIndex=v.findIndex(r=>String(r[i.dataset_key]||'')===key&&String(r[i.periode]||'')===period)+1;
  if(rowIndex<=0)throw new Error('PERIOD_NOT_CLOSED: '+key+' '+period);
  const current=String(v[rowIndex-1][i.status]||'OPEN').toUpperCase();
  if(current!=='CLOSED')throw new Error('PERIOD_NOT_CLOSED: '+key+' '+period);
  const now=nowIso_();
  sh.getRange(rowIndex,i.status+1,1,3).setValues([['OPEN',String(v[rowIndex-1][i.closed_by]||''),String(v[rowIndex-1][i.closed_at]||'')]]);
  sh.getRange(rowIndex,i.reason+1).setValue(why);
  sh.getRange(rowIndex,i.reopened_by+1,1,2).setValues([[user.email,now]]);
  appendAudit_('PERIOD_REOPEN',key,String(v[rowIndex-1][i.closure_id]||''),0,'SUCCESS',JSON.stringify({periode:period,reason:why,correction:true}));
  return {ok:true,datasetKey:key,periode:period,status:'OPEN',correctionRequired:true};
}
