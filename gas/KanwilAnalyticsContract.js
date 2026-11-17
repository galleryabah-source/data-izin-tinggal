/**
 * Kanwil aggregate analytics and TV privacy contract.
 * Pure functions: no storage, RPC, or external services.
 */
const KANWIL_TV_FORBIDDEN_FIELDS_V1=Object.freeze([
  'nama','tanggal_lahir','no_passport','nomor_permohonan','penjamin'
]);
const KANWIL_TV_ALLOWED_DIMENSIONS_V1=Object.freeze([
  'layanan','kategori_produk','jenis_produk','kebangsaan','tujuan',
  'posisi_permohonan','status_permohonan'
]);
function kanwilSafeDimension_(value){
  const s=String(value==null?'':value).trim();
  return s||'TIDAK DIKETAHUI';
}
function kanwilGroupCountV1_(rows,key){
  const counts=new Map();
  (Array.isArray(rows)?rows:[]).forEach(row=>{
    const value=kanwilSafeDimension_(row&&row[key]);
    counts.set(value,(counts.get(value)||0)+1);
  });
  return Array.from(counts.entries()).map(([label,count])=>({label,count}))
    .sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'id'));
}
function buildKanwilAggregateV1_(rows){
  const source=Array.isArray(rows)?rows:[];
  return {
    contractVersion:'KANWIL_AGGREGATE_V1',
    totalPermohonan:source.length,
    jumlahLayanan:kanwilGroupCountV1_(source,'layanan'),
    kategoriProduk:kanwilGroupCountV1_(source,'kategori_produk'),
    jenisProduk:kanwilGroupCountV1_(source,'jenis_produk'),
    kebangsaan:kanwilGroupCountV1_(source,'kebangsaan'),
    tujuan:kanwilGroupCountV1_(source,'tujuan'),
    posisiPermohonan:kanwilGroupCountV1_(source,'posisi_permohonan'),
    statusPermohonan:kanwilGroupCountV1_(source,'status_permohonan')
  };
}
/**
 * Public TV projection is intentionally aggregate-only. Never spread source rows
 * or return any identifier, name, date of birth, passport, or sponsor field.
 */
function projectKanwilTvAggregateV1_(rows){
  const aggregate=buildKanwilAggregateV1_(rows);
  return Object.freeze({
    contractVersion:aggregate.contractVersion,
    totalPermohonan:aggregate.totalPermohonan,
    jumlahLayanan:aggregate.jumlahLayanan,
    kategoriProduk:aggregate.kategoriProduk,
    jenisProduk:aggregate.jenisProduk,
    kebangsaan:aggregate.kebangsaan,
    tujuan:aggregate.tujuan,
    statusPermohonan:aggregate.statusPermohonan
  });
}

function kanwilDistributionV1_(rows,key){
 const total=Array.isArray(rows)?rows.length:0;
 return kanwilGroupCountV1_(rows,key).map(x=>({label:x.label,count:x.count,percentage:total?Number((x.count*100/total).toFixed(2)):0}));
}
function kanwilCrossTabV1_(rows,rowKey,columnKey){
 const cells=new Map();
 (Array.isArray(rows)?rows:[]).forEach(r=>{const a=kanwilSafeDimension_(r&&r[rowKey]),b=kanwilSafeDimension_(r&&r[columnKey]),k=JSON.stringify([a,b]);cells.set(k,(cells.get(k)||0)+1);});
 return Array.from(cells.entries()).map(([k,count])=>{const p=JSON.parse(k);return {row:p[0],column:p[1],count};}).sort((a,b)=>a.row.localeCompare(b.row,'id')||a.column.localeCompare(b.column,'id'));
}
function kanwilDateKey_(value){
  const raw=String(value==null?'':value).trim();
  if(!raw)return null;
  const m=raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
  if(m)return m[1]+'-'+m[2]+'-'+m[3];
  const d=new Date(raw);
  return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);
}
function kanwilApprovedRowsV1_(records){
  return (Array.isArray(records)?records:[]).filter(r=>
    r&&['APPROVED','COMMITTED'].includes(String(r.record_state||'').toUpperCase())
  );
}
function buildKanwilWorkspaceAnalyticsV1_(records,filters){
  const f=filters||{};
  const from=kanwilDateKey_(f.fromDate),to=kanwilDateKey_(f.toDate);
  const approved=kanwilApprovedRowsV1_(records);
  const rows=approved.filter(r=>{
    const d=kanwilDateKey_(r.tanggal_permohonan);
    if(from&&(!d||d<from))return false;
    if(to&&(!d||d>to))return false;
    return ['layanan','kategori_produk','jenis_produk','kebangsaan','tujuan','posisi_permohonan','status_permohonan']
      .every(k=>!f[k]||String(r[k]||'')===String(f[k]));
  });
  const base=buildKanwilAggregateV1_(rows);
  const daily=new Map();
  rows.forEach(r=>{const d=kanwilDateKey_(r.tanggal_permohonan);if(d)daily.set(d,(daily.get(d)||0)+1);});
  const monthly=new Map();
  daily.forEach((count,date)=>{const month=date.slice(0,7);monthly.set(month,(monthly.get(month)||0)+count);});
  const required=['nomor_permohonan','nama','layanan','kategori_produk','tanggal_permohonan','kebangsaan','jenis_produk','tujuan','status_permohonan'];
  const missing={};required.forEach(k=>{missing[k]=rows.filter(r=>!String(r[k]||'').trim()).length;});
  const duplicateNumbers=new Map();
  rows.forEach(r=>{const key=String(r.nomor_permohonan||'').trim();if(key)duplicateNumbers.set(key,(duplicateNumbers.get(key)||0)+1);});
  const duplicateApplicationNumbers=Array.from(duplicateNumbers.values()).filter(n=>n>1).length;
  return {
    contractVersion:'KANWIL_WORKSPACE_ANALYTICS_V1',
    dateBasis:'tanggal_permohonan',
    approvedRecordCount:rows.length,
    totalPermohonan:base.totalPermohonan,
    jumlahLayanan:kanwilDistributionV1_(rows,'layanan'),kategoriProduk:kanwilDistributionV1_(rows,'kategori_produk'),
    jenisProduk:kanwilDistributionV1_(rows,'jenis_produk'),kebangsaan:kanwilDistributionV1_(rows,'kebangsaan'),tujuan:kanwilDistributionV1_(rows,'tujuan'),
    posisiPermohonan:kanwilDistributionV1_(rows,'posisi_permohonan'),statusPermohonan:kanwilDistributionV1_(rows,'status_permohonan'),
    analisisSilang:{layananKebangsaan:kanwilCrossTabV1_(rows,'layanan','kebangsaan'),layananStatus:kanwilCrossTabV1_(rows,'layanan','status_permohonan'),produkTujuan:kanwilCrossTabV1_(rows,'jenis_produk','tujuan')},
    harian:Array.from(daily.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,count])=>({date,count})),
    bulanan:Array.from(monthly.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([month,count])=>({month,count})),
    kualitasData:{missingRequiredFields:missing,duplicateApplicationNumberGroups:duplicateApplicationNumbers}
  };
}
if(typeof module!=='undefined'&&module.exports)module.exports={
 KANWIL_TV_FORBIDDEN_FIELDS_V1,KANWIL_TV_ALLOWED_DIMENSIONS_V1,
 buildKanwilAggregateV1_,projectKanwilTvAggregateV1_,kanwilApprovedRowsV1_,buildKanwilWorkspaceAnalyticsV1_,kanwilDistributionV1_,kanwilCrossTabV1_
};
