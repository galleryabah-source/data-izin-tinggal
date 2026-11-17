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
if(typeof module!=='undefined'&&module.exports)module.exports={
 KANWIL_TV_FORBIDDEN_FIELDS_V1,KANWIL_TV_ALLOWED_DIMENSIONS_V1,
 buildKanwilAggregateV1_,projectKanwilTvAggregateV1_
};
