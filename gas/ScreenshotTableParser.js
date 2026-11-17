/**
 * INTAL Smart Screenshot Entry — deterministic geometry parser.
 * Pure functions only: no Apps Script services, network, storage, or RPC.
 * Input words: [{text, confidence, bbox:{x0,y0,x1,y1}}].
 */
const SCREENSHOT_COLUMNS_V1 = [
  ['tanggal_pembayaran',['tanggal pembayaran']],
  ['tanggal_approval_kakanim',['tanggal approval kakanim']],
  ['tanggal_mulai_verifikasi',['tanggal mulai verifikasi']],
  ['tanggal_auto_terbit',['tanggal auto terbit']],
  ['layanan',['layanan']],
  ['kategori_produk',['kategori produk']],
  ['nomor_permohonan',['nomor permohonan','no permohonan']],
  ['tanggal_permohonan',['tanggal permohonan']],
  ['penjamin',['penjamin']],
  ['nama',['nama']],
  ['jenis_kelamin',['jenis kelamin']],
  ['tanggal_lahir',['tanggal lahir']],
  ['kebangsaan',['kebangsaan']],
  ['no_passport',['no passport','nomor paspor','no paspor','no passport number']],
  ['jenis_produk',['jenis produk']],
  ['tujuan',['tujuan']],
  ['posisi_permohonan',['posisi permohonan']],
  ['kantor_imigrasi',['kantor imigrasi','kanim']],
  ['status_permohonan',['status permohonan']]
];
function sseNormalizeHeader_(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function sseGroupLines_(words, tolerance) {
  const sorted = (words || []).filter(w => w && w.bbox && Number.isFinite(w.bbox.y0) && Number.isFinite(w.bbox.y1) && String(w.text || '').trim())
    .slice().sort((a,b) => ((a.bbox.y0+a.bbox.y1)/2)-((b.bbox.y0+b.bbox.y1)/2) || a.bbox.x0-b.bbox.x0);
  const lines = [];
  sorted.forEach(word => {
    const cy=(word.bbox.y0+word.bbox.y1)/2;
    let line=lines.find(x=>Math.abs(x.cy-cy)<=tolerance);
    if(!line){line={cy,words:[]};lines.push(line);}
    line.words.push(word);
    line.cy=line.words.reduce((n,w)=>n+(w.bbox.y0+w.bbox.y1)/2,0)/line.words.length;
  });
  lines.sort((a,b)=>a.cy-b.cy);
  lines.forEach(line=>line.words.sort((a,b)=>a.bbox.x0-b.bbox.x0));
  return lines;
}
function sseGroupHeaderCells_(words, gap) {
  const groups=[];
  words.forEach(word=>{
    const last=groups[groups.length-1];
    if(last && word.bbox.x0-last.x1<=gap){last.words.push(word);last.x1=Math.max(last.x1,word.bbox.x1);}
    else groups.push({words:[word],x0:word.bbox.x0,x1:word.bbox.x1});
  });
  return groups.map(g=>({...g,text:g.words.map(w=>String(w.text).trim()).join(' ')}));
}
function reconstructScreenshotTableV1(words, options) {
  const opt=options||{}, tolerance=Number.isFinite(opt.lineTolerance)?opt.lineTolerance:12;
  const headerGap=Number.isFinite(opt.headerWordGap)?opt.headerWordGap:14;
  const lines=sseGroupLines_(words,tolerance);
  if(!lines.length)return {ok:false,reason:'NO_TEXT_WORDS',rows:[],header:[]};
  const candidates=lines.map((line,index)=>({index,cells:sseGroupHeaderCells_(line.words,headerGap)}))
    .map(x=>({...x,matched:x.cells.map(cell=>({cell,key:SCREENSHOT_COLUMNS_V1.find(([,aliases])=>aliases.includes(sseNormalizeHeader_(cell.text)))?.[0]||null}))}))
    .sort((a,b)=>b.matched.filter(x=>x.key).length-a.matched.filter(x=>x.key).length);
  const header=candidates[0];
  const mapped=header.matched.filter(x=>x.key);
  const keys=mapped.map(x=>x.key);
  const missing=SCREENSHOT_COLUMNS_V1.map(x=>x[0]).filter(k=>!keys.includes(k));
  const duplicate=keys.filter((k,i)=>keys.indexOf(k)!==i);
  if(missing.length||duplicate.length||mapped.length!==19)
    return {ok:false,reason:'HEADER_MAPPING_INCOMPLETE_OR_AMBIGUOUS',missing,duplicate,header:header.cells.map(c=>c.text),rows:[]};
  const columns=mapped.map(x=>({key:x.key,center:(x.cell.x0+x.cell.x1)/2})).sort((a,b)=>a.center-b.center);
  const bounds=columns.map((c,i)=>({key:c.key,left:i===0?-Infinity:(columns[i-1].center+c.center)/2,right:i===columns.length-1?Infinity:(c.center+columns[i+1].center)/2}));
  const output=[];
  lines.slice(header.index+1).forEach((line,index)=>{
    const cells=Object.fromEntries(columns.map(c=>[c.key,[]]));
    line.words.forEach(word=>{
      const cx=(word.bbox.x0+word.bbox.x1)/2;
      const column=bounds.find(c=>cx>=c.left&&cx<c.right);
      if(column)cells[column.key].push(word);
    });
    const values={};
    Object.keys(cells).forEach(key=>{values[key]=cells[key].sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>String(w.text).trim()).filter(Boolean).join(' ')||null;});
    if(Object.values(values).some(v=>v!==null))output.push({sourceRowIndex:index+1,values,warnings:['OCR_GEOMETRY_REQUIRES_HUMAN_REVIEW']});
  });
  return {ok:true,reason:null,header:columns.map(c=>c.key),rows:output,warnings:['NO_AUTO_COMMIT','VERIFY_EACH_CELL_AGAINST_SOURCE']};
}
if(typeof module!=='undefined'&&module.exports)module.exports={SCREENSHOT_COLUMNS_V1,sseNormalizeHeader_,sseGroupLines_,reconstructScreenshotTableV1};
