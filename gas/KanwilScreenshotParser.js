/** Dedicated deterministic OCR geometry parser for the 17-column Kanwil source. */
const KANWIL_SCREENSHOT_COLUMNS_V1 = [
 ['tanggal_pembayaran',['tanggal pembayaran']],['tanggal_mulai_verifikasi',['tanggal mulai verifikasi']],
 ['tanggal_auto_terbit',['tanggal auto terbit']],['layanan',['layanan']],['kategori_produk',['kategori produk']],
 ['nomor_permohonan',['nomor permohonan','no permohonan']],['tanggal_permohonan',['tanggal permohonan']],
 ['penjamin',['penjamin']],['nama',['nama']],['jenis_kelamin',['jenis kelamin']],['tanggal_lahir',['tanggal lahir']],
 ['kebangsaan',['kebangsaan']],['no_passport',['no passport','no. passport','nomor paspor','no paspor']],
 ['jenis_produk',['jenis produk']],['tujuan',['tujuan']],['posisi_permohonan',['posisi permohonan']],
 ['status_permohonan',['status permohonan']]
];
function kanwilShotNormalize_(v){return String(v==null?'':v).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function kanwilShotLines_(words,tolerance){
 const sorted=(words||[]).filter(w=>w&&w.bbox&&Number.isFinite(w.bbox.x0)&&Number.isFinite(w.bbox.x1)&&Number.isFinite(w.bbox.y0)&&Number.isFinite(w.bbox.y1)&&String(w.text||'').trim()).slice().sort((a,b)=>(a.bbox.y0+a.bbox.y1)-(b.bbox.y0+b.bbox.y1)||a.bbox.x0-b.bbox.x0);
 const lines=[];
 sorted.forEach(w=>{const cy=(w.bbox.y0+w.bbox.y1)/2;let line=lines.find(x=>Math.abs(x.cy-cy)<=tolerance);if(!line){line={cy,words:[]};lines.push(line);}line.words.push(w);line.cy=line.words.reduce((s,x)=>s+(x.bbox.y0+x.bbox.y1)/2,0)/line.words.length;});
 lines.sort((a,b)=>a.cy-b.cy);lines.forEach(l=>l.words.sort((a,b)=>a.bbox.x0-b.bbox.x0));return lines;
}
function kanwilShotCells_(words,gap){
 const groups=[];words.forEach(w=>{const last=groups[groups.length-1];if(last&&w.bbox.x0-last.x1<=gap){last.words.push(w);last.x1=Math.max(last.x1,w.bbox.x1);}else groups.push({words:[w],x0:w.bbox.x0,x1:w.bbox.x1});});
 return groups.map(g=>({...g,text:g.words.map(w=>String(w.text).trim()).join(' ')}));
}
function reconstructKanwilScreenshotTableV1(words,options){
 const opt=options||{},lines=kanwilShotLines_(words,Number.isFinite(opt.lineTolerance)?opt.lineTolerance:12);
 if(!lines.length)return {ok:false,reason:'NO_TEXT_WORDS',rows:[],header:[]};
 const gap=Number.isFinite(opt.headerWordGap)?opt.headerWordGap:14;
 const candidates=lines.map((line,index)=>({index,cells:kanwilShotCells_(line.words,gap)})).map(x=>({...x,matched:x.cells.map(cell=>({cell,key:KANWIL_SCREENSHOT_COLUMNS_V1.find(([,a])=>a.includes(kanwilShotNormalize_(cell.text)))?.[0]||null}))})).sort((a,b)=>b.matched.filter(x=>x.key).length-a.matched.filter(x=>x.key).length);
 const header=candidates[0],mapped=header.matched.filter(x=>x.key),keys=mapped.map(x=>x.key);
 const missing=KANWIL_SCREENSHOT_COLUMNS_V1.map(x=>x[0]).filter(k=>!keys.includes(k)),duplicate=keys.filter((k,i)=>keys.indexOf(k)!==i);
 if(missing.length||duplicate.length||mapped.length!==17)return {ok:false,reason:'HEADER_MAPPING_INCOMPLETE_OR_AMBIGUOUS',missing,duplicate,header:header.cells.map(c=>c.text),rows:[]};
 const columns=mapped.map(x=>({key:x.key,center:(x.cell.x0+x.cell.x1)/2})).sort((a,b)=>a.center-b.center);
 const bounds=columns.map((c,i)=>({key:c.key,left:i? (columns[i-1].center+c.center)/2:-Infinity,right:i<columns.length-1?(c.center+columns[i+1].center)/2:Infinity}));
 const rows=[];
 lines.slice(header.index+1).forEach((line,index)=>{
  const buckets=Object.fromEntries(columns.map(c=>[c.key,[]]));
  line.words.forEach(w=>{const cx=(w.bbox.x0+w.bbox.x1)/2;const col=bounds.find(b=>cx>=b.left&&cx<b.right);if(col)buckets[col.key].push(w);});
  const values={},fieldEvidence={};
  Object.keys(buckets).forEach(key=>{const ws=buckets[key].sort((a,b)=>a.bbox.x0-b.bbox.x0);values[key]=ws.map(w=>String(w.text).trim()).filter(Boolean).join(' ')||null;fieldEvidence[key]=ws.length?{words:ws.map(w=>({text:String(w.text),confidence:Number.isFinite(w.confidence)?w.confidence:null,bbox:{...w.bbox}})),meanConfidence:ws.every(w=>Number.isFinite(w.confidence))?ws.reduce((s,w)=>s+w.confidence,0)/ws.length:null}:null;});
  if(Object.values(values).some(v=>v!==null))rows.push({sourceRowIndex:index+1,values,fieldEvidence,warnings:['OCR_GEOMETRY_REQUIRES_HUMAN_REVIEW']});
 });
 return {ok:true,reason:null,header:columns.map(c=>c.key),rows,warnings:['NO_AUTO_COMMIT','VERIFY_EACH_CELL_AGAINST_SOURCE']};
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_SCREENSHOT_COLUMNS_V1,reconstructKanwilScreenshotTableV1};
