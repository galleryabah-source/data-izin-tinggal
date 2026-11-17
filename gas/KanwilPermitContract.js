/**
 * INTAL Kanwil Residence Permit — isolated v1 contract and CSV parser.
 * Pure JavaScript: no Apps Script services, network, persistence, or RPC.
 * Source contract is the 17-column Kanwil table; do not reuse monthly import.
 */
const KANWIL_PERMIT_COLUMNS_V1 = [
  ['tanggal_pembayaran',['tanggal pembayaran'],'timestamp'],
  ['tanggal_mulai_verifikasi',['tanggal mulai verifikasi'],'timestamp'],
  ['tanggal_auto_terbit',['tanggal auto terbit'],'timestamp'],
  ['layanan',['layanan'],'text'],
  ['kategori_produk',['kategori produk'],'text'],
  ['nomor_permohonan',['nomor permohonan','no permohonan'],'identifier'],
  ['tanggal_permohonan',['tanggal permohonan'],'timestamp'],
  ['penjamin',['penjamin'],'text'],
  ['nama',['nama'],'text'],
  ['jenis_kelamin',['jenis kelamin'],'text'],
  ['tanggal_lahir',['tanggal lahir'],'date'],
  ['kebangsaan',['kebangsaan'],'text'],
  ['no_passport',['no passport','nomor paspor','no paspor','no. passport'],'identifier'],
  ['jenis_produk',['jenis produk'],'text'],
  ['tujuan',['tujuan'],'text'],
  ['posisi_permohonan',['posisi permohonan'],'text'],
  ['status_permohonan',['status permohonan'],'text']
];
function kanwilNormalizeHeaderV1_(value) {
  return String(value == null ? '' : value).normalize('NFKC').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function kanwilParseDelimitedV1_(source, delimiter) {
  const text=String(source == null ? '' : source).replace(/^\uFEFF/,'');
  const sep=delimiter || ',';
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"' && text[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=false;
      else cell+=ch;
    } else if(ch==='"' && cell==='') quoted=true;
    else if(ch===sep){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)return {ok:false,reason:'CSV_UNCLOSED_QUOTE',rows:[]};
  if(cell!==''||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  while(rows.length && rows[rows.length-1].every(v=>String(v).trim()===''))rows.pop();
  return {ok:true,rows};
}
function kanwilMapHeadersV1_(headers) {
  const aliases=new Map();
  KANWIL_PERMIT_COLUMNS_V1.forEach(([key,names])=>names.forEach(name=>aliases.set(kanwilNormalizeHeaderV1_(name),key)));
  const mapping=[],seen=new Set(),unknown=[];
  headers.forEach((header,index)=>{
    const normalized=kanwilNormalizeHeaderV1_(header);
    const key=aliases.get(normalized)||null;
    if(!key){unknown.push({index,header:String(header)});return;}
    if(seen.has(key))return;
    seen.add(key);mapping.push({index,key});
  });
  const duplicateKeys=[];
  const found=mapping.map(x=>x.key);
  KANWIL_PERMIT_COLUMNS_V1.forEach(([key])=>{
    const count=headers.filter(h=>aliases.get(kanwilNormalizeHeaderV1_(h))===key).length;
    if(count>1)duplicateKeys.push(key);
  });
  const missing=KANWIL_PERMIT_COLUMNS_V1.map(([key])=>key).filter(key=>!seen.has(key));
  return {ok:missing.length===0&&duplicateKeys.length===0,reason:missing.length||duplicateKeys.length?'HEADER_MAPPING_INCOMPLETE_OR_AMBIGUOUS':null,mapping,missing,duplicateKeys,unknown};
}
function kanwilValidateValueV1_(key, raw) {
  const value=String(raw == null ? '' : raw).trim();
  if(!value)return {raw:raw == null ? '' : String(raw),value:null,warnings:[]};
  if(key==='nomor_permohonan'||key==='no_passport')return {raw:String(raw),value:String(raw).trim(),warnings:[]};
  if(key==='tanggal_lahir'){
    const iso=/^\d{4}-\d{2}-\d{2}$/.test(value);
    if(!iso)return {raw:String(raw),value:null,warnings:['DATE_REQUIRES_REVIEW']};
    const d=new Date(value+'T00:00:00Z');
    if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)return {raw:String(raw),value:null,warnings:['INVALID_DATE']};
    return {raw:String(raw),value,warnings:[]};
  }
  if(key.startsWith('tanggal_')){
    // Preserve source timestamp until source timezone convention is verified.
    const iso=/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(value);
    return {raw:String(raw),value:iso?value:null,warnings:iso?['TIMEZONE_UNCONFIRMED']:['DATETIME_REQUIRES_REVIEW']};
  }
  return {raw:String(raw),value,warnings:[]};
}
function parseKanwilPermitCsvV1(source, options) {
  const opt=options||{};
  const delimiter=opt.delimiter || ',';
  const parsed=kanwilParseDelimitedV1_(source,delimiter);
  if(!parsed.ok)return {...parsed,records:[]};
  if(parsed.rows.length<2)return {ok:false,reason:'NO_DATA_ROWS',records:[]};
  const header=kanwilMapHeadersV1_(parsed.rows[0]);
  if(!header.ok)return {ok:false,reason:header.reason,missing:header.missing,duplicateKeys:header.duplicateKeys,unknownHeaders:header.unknown,records:[]};
  const records=[];
  parsed.rows.slice(1).forEach((cells,index)=>{
    if(cells.every(v=>String(v).trim()===''))return;
    if(cells.length!==parsed.rows[0].length){
      records.push({sourceRowNumber:index+2,ok:false,reason:'COLUMN_COUNT_MISMATCH',rawCells:cells});
      return;
    }
    const rawValues={},normalizedValues={},warnings=[];
    header.mapping.forEach(({index:columnIndex,key})=>{
      const result=kanwilValidateValueV1_(key,cells[columnIndex]);
      rawValues[key]=result.raw;normalizedValues[key]=result.value;
      result.warnings.forEach(code=>warnings.push({field:key,code}));
    });
    if(!normalizedValues.nomor_permohonan)warnings.push({field:'nomor_permohonan',code:'REQUIRED_IDENTIFIER_MISSING'});
    records.push({sourceRowNumber:index+2,ok:!!normalizedValues.nomor_permohonan,rawValues,normalizedValues,warnings});
  });
  return {ok:true,reason:null,contractVersion:'KANWIL_PERMIT_APPLICATION_V1',headerMapping:header.mapping,unknownHeaders:header.unknown,records,warnings:['HUMAN_REVIEW_REQUIRED','NO_AUTO_COMMIT']};
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_PERMIT_COLUMNS_V1,kanwilNormalizeHeaderV1_,kanwilMapHeadersV1_,parseKanwilPermitCsvV1};
