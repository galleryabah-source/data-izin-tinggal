function ensureOfficeReferenceSheet(){
  requirePermission_('admin.config');
  const ss=getDb_();
  let sh=ss.getSheetByName('OFFICE_REFERENCE');
  const header=['office_key','kantor_imigrasi','address','latitude','longitude','source_url','verified_at','status'];
  if(!sh){
    sh=ss.insertSheet('OFFICE_REFERENCE');
    sh.getRange(1,1,1,header.length).setValues([header]);
    sh.setFrozenRows(1);
  }else{
    const current=sh.getRange(1,1,1,header.length).getValues()[0];
    if(header.join('|')!==current.join('|'))throw new Error('OFFICE_REFERENCE_SCHEMA_MISMATCH');
  }
  return {ok:true,sheetName:sh.getName(),columns:header,rowCount:Math.max(0,sh.getLastRow()-1)};
}

function getOfficeReferenceStatus(){
  requirePermission_('map.read');
  const ss=getDb_();
  const source=ss.getSheetByName(APP.SHEET_PREFIX+'RESIDENCE_PERMIT_SERVICE_MONTHLY');
  if(!source)throw new Error('DATASET_SHEET_NOT_FOUND: '+APP.SHEET_PREFIX+'RESIDENCE_PERMIT_SERVICE_MONTHLY');
  const values=source.getDataRange().getValues();
  if(values.length<2)return {ok:true,expectedOffices:[],referenceRows:0,missingOffices:[],invalidOffices:[],ready:false};
  const h=values[0],hi=Object.fromEntries(h.map((x,n)=>[x,n]));
  const expected=[...new Set(values.slice(1).filter(r=>r.some(v=>String(v)!=='')).map(r=>String(r[hi.kantor_imigrasi]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
  const ref=ss.getSheetByName('OFFICE_REFERENCE');
  if(!ref)return {ok:true,expectedOffices:expected,referenceRows:0,missingOffices:expected,invalidOffices:[],ready:false};
  const rv=ref.getDataRange().getValues(),rh=rv[0]||[],ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
  const byOffice={};
  rv.slice(1).filter(r=>r.some(v=>String(v)!=='')).forEach(r=>{
    const name=String(r[ri.kantor_imigrasi]||'').trim();
    if(name)byOffice[name]=r;
  });
  const invalidOffices=[],missingOffices=[];
  expected.forEach(name=>{
    const r=byOffice[name];
    if(!r){missingOffices.push(name);return;}
    const lat=Number(r[ri.latitude]),lng=Number(r[ri.longitude]),address=String(r[ri.address]||'').trim(),sourceUrl=String(r[ri.source_url]||'').trim(),status=String(r[ri.status]||'').trim().toUpperCase();
    if(!address||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180||!sourceUrl||status!=='VERIFIED')invalidOffices.push(name);
  });
  return {ok:true,expectedOffices:expected,referenceRows:Math.max(0,rv.length-1),missingOffices,invalidOffices,ready:missingOffices.length===0&&invalidOffices.length===0};
}
