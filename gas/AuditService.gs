function appendAudit_(action,datasetKey,batchId,affectedRows,status,details){const u=getCurrentUser_();getDb_().getSheetByName(SHEETS.AUDIT_LOG).appendRow([Utilities.getUuid(),nowIso_(),u.email||'system',action,datasetKey||'',batchId||'',affectedRows||0,status||'SUCCESS',details||'']);}

function listAuditEventsAdmin(filters){
  requirePermission_('audit.read');
  const p=filters||{},limit=Math.min(200,Math.max(1,Number(p.limit||100)||100));
  const actor=String(p.actor||'').trim().toLowerCase();
  const action=String(p.action||'').trim().toUpperCase();
  const datasetKey=String(p.datasetKey||'').trim().toUpperCase();
  const status=String(p.status||'').trim().toUpperCase();
  const from=String(p.from||'').trim(),to=String(p.to||'').trim();
  const sh=getDb_().getSheetByName(SHEETS.AUDIT_LOG);
  if(!sh||sh.getLastRow()<2)return {ok:true,rows:[],total:0,limit,filters:{actor,action,datasetKey,status,from,to}};
  const values=sh.getDataRange().getValues(),h=values[0]||[],i=Object.fromEntries(h.map((x,n)=>[String(x),n]));
  const toIso=v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"):String(v||'');
  const fromMs=from?new Date(from+'T00:00:00+07:00').getTime():NaN;
  const toMs=to?new Date(to+'T23:59:59+07:00').getTime():NaN;
  const rows=[];
  for(let n=1;n<values.length;n++){
    const r=values[n],timestamp=toIso(r[i.timestamp]),eventMs=new Date(timestamp).getTime();
    if(actor&&!String(r[i.actor]||'').toLowerCase().includes(actor))continue;
    if(action&&String(r[i.action]||'').toUpperCase()!==action)continue;
    if(datasetKey&&String(r[i.dataset_key]||'').toUpperCase()!==datasetKey)continue;
    if(status&&String(r[i.status]||'').toUpperCase()!==status)continue;
    if(Number.isFinite(fromMs)&&(!Number.isFinite(eventMs)||eventMs<fromMs))continue;
    if(Number.isFinite(toMs)&&(!Number.isFinite(eventMs)||eventMs>toMs))continue;
    rows.push({
      eventId:String(r[i.event_id]||''),timestamp,actor:String(r[i.actor]||''),action:String(r[i.action]||''),
      datasetKey:String(r[i.dataset_key]||''),batchId:String(r[i.batch_id]||''),affectedRows:Number(r[i.affected_rows]||0),
      status:String(r[i.status]||''),details:String(r[i.details]||'')
    });
  }
  rows.sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));
  const sliced=rows.slice(0,limit);
  return {ok:true,rows:sliced,total:rows.length,limit,filters:{actor,action,datasetKey,status,from,to}};
}
