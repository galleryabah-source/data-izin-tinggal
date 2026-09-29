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
  const rv=ref.getDataRange().getValues(),rh=rv[0]||[],expectedHeader=['office_key','kantor_imigrasi','address','latitude','longitude','source_url','verified_at','status'];
  if(expectedHeader.join('|')!==rh.slice(0,expectedHeader.length).join('|'))throw new Error('OFFICE_REFERENCE_SCHEMA_MISMATCH');
  const ri=Object.fromEntries(rh.map((x,n)=>[x,n]));
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


function seedOfficeReferenceDraft(){
  requirePermission_('admin.config');
  ensureOfficeReferenceSheet();
  const ss=getDb_();
  const sh=ss.getSheetByName('OFFICE_REFERENCE');
  const values=sh.getDataRange().getValues();
  const header=values[0]||[];
  const hi=Object.fromEntries(header.map((x,n)=>[x,n]));
  const existing=new Set(values.slice(1).map(r=>String(r[hi.kantor_imigrasi]||'').trim()).filter(Boolean));

  const draftRows=[
    ['KANIM_KELAS_I_NON_TPI_BEKASI','KANIM KELAS I NON TPI BEKASI','Jl. Perjuangan No.100, RT.2/RW.1, Teluk Pucung, Kec. Bekasi Utara, Kota Bekasi, Jawa Barat','','','https://bekasi.imigrasi.go.id/ticker/running-text/','','PENDING'],
    ['KANIM_KELAS_I_NON_TPI_BOGOR','KANIM KELAS I NON TPI BOGOR','Jl. A. Yani No.19, Tanah Sareal, Kec. Tanah Sareal, Kota Bogor, Jawa Barat','','','https://bogor.imigrasi.go.id/','','PENDING'],
    ['KANIM_KELAS_I_NON_TPI_DEPOK','KANIM KELAS I NON TPI DEPOK','Jl. Boulevard Grand Depok City, Kalimulya, Kec. Cilodong, Kota Depok, Jawa Barat 16413','','','https://depok.imigrasi.go.id/informasi/','','PENDING'],
    ['KANIM_KELAS_I_NON_TPI_KARAWANG','KANIM KELAS I NON TPI KARAWANG','Jalan Jenderal Ahmad Yani No. 18, Karawang, Jawa Barat 41312','','','https://karawang.imigrasi.go.id/kontak-kami/','','PENDING'],
    ['KANIM_KELAS_I_NON_TPI_TASIKMALAYA','KANIM KELAS I NON TPI TASIKMALAYA','Jl. Letnan Harun, Sukarindik, Kec. Bungursari, Tasikmalaya','','','https://kanimtasik.kemenkumham.go.id/','','PENDING'],
    ['KANIM_KELAS_I_TPI_BANDUNG','KANIM KELAS I TPI BANDUNG','Jl. Surapati No.82, Cihaur Geulis, Kec. Cibeunying Kaler, Kota Bandung, Jawa Barat 40122','','','https://mpp.bandung.go.id/portfolio/view/2','','PENDING'],
    ['KANIM_KELAS_I_TPI_CIREBON','KANIM KELAS I TPI CIREBON','Jl. Sultan Ageng Tirtayasa No.51, Kedungdawa, Kec. Kedawung, Kabupaten Cirebon, Jawa Barat 45153','','','https://cirebon.imigrasi.go.id/','','PENDING'],
    ['KANIM_KELAS_II_NON_TPI_GARUT','KANIM KELAS II NON TPI GARUT','','','','https://garut.imigrasi.go.id/','','PENDING'],
    ['KANIM_KELAS_II_NON_TPI_SUKABUMI','KANIM KELAS II NON TPI SUKABUMI','Jl. Lingkar Selatan No.7, Sudajaya Hilir, Kec. Baros, Kota Sukabumi, Jawa Barat 43161','','','https://sukabumi.imigrasi.go.id/','','PENDING'],
    ['KANIM_KELAS_III_NON_TPI_CIANJUR','KANIM KELAS III NON TPI CIANJUR','Jl. Raya Bandung No.61, Sabandar, Kec. Karangtengah, Kabupaten Cianjur, Jawa Barat 43281','','','https://kanimcianjur.kemenkumham.go.id/index.php','','PENDING']
  ];

  const rows=draftRows.filter(r=>!existing.has(r[1]));
  if(rows.length)sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
  appendAudit_('OFFICE_REFERENCE_DRAFT_SEED','', '',rows.length,'SUCCESS',JSON.stringify({inserted:rows.length,skipped:draftRows.length-rows.length,status:'PENDING'}));
  return {ok:true,inserted:rows.length,skipped:draftRows.length-rows.length,status:'PENDING'};
}


function prepareOfficeReferenceDraftMetadata(){
  requirePermission_('admin.config');
  ensureOfficeReferenceSheet();
  const ss=getDb_();
  const sh=ss.getSheetByName('OFFICE_REFERENCE');
  const values=sh.getDataRange().getValues();
  const h=values[0]||[],i=Object.fromEntries(h.map((x,n)=>[x,n]));
  let updated=0;
  values.slice(1).forEach((r,n)=>{
    const name=String(r[i.kantor_imigrasi]||'').trim();
    if(name==='KANIM KELAS II NON TPI GARUT' && !String(r[i.address]||'').trim()){
      sh.getRange(n+2,i.address+1).setValue('Jalan Patriot No.10, Kecamatan Tarogong Kidul, Kabupaten Garut, Jawa Barat');
      if(!String(r[i.source_url]||'').trim()) sh.getRange(n+2,i.source_url+1).setValue('https://www.garutkab.go.id/berita/kantor-imigrasi-kelas-ii-non-tpi-garut-resmi-dibuka-permudah-warga-urus-keimigrasian');
      updated++;
    }
  });
  if(updated) appendAudit_('OFFICE_REFERENCE_DRAFT_REPAIR','', '',updated,'SUCCESS',JSON.stringify({updated,status:'PENDING'}));
  return {ok:true,updated,status:'PENDING'};
}

function previewOfficeReferenceGeocoding(){
  requirePermission_('admin.config');
  const ss=getDb_(),sh=ss.getSheetByName('OFFICE_REFERENCE');
  if(!sh)throw new Error('OFFICE_REFERENCE_NOT_FOUND');
  const values=sh.getDataRange().getValues(),h=values[0]||[],i=Object.fromEntries(h.map((x,n)=>[x,n]));
  const candidates=[];
  values.slice(1).forEach((r,n)=>{
    const name=String(r[i.kantor_imigrasi]||'').trim();
    const address=String(r[i.address]||'').trim();
    const status=String(r[i.status]||'').trim().toUpperCase();
    if(!name||!address||status==='VERIFIED')return;
    const response=Maps.newGeocoder().setLanguage('id').setRegion('id').geocode(address);
    const results=(response.results||[]).slice(0,3).map(x=>({
      office:name,
      row:n+2,
      address,
      formattedAddress:String(x.formatted_address||''),
      latitude:x.geometry&&x.geometry.location?Number(x.geometry.location.lat):null,
      longitude:x.geometry&&x.geometry.location?Number(x.geometry.location.lng):null
    }));
    candidates.push(...results);
  });
  return {ok:true,count:candidates.length,candidates};
}
