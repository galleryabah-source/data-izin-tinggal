/** Dedicated OCR geometry parser for the 17-column Kanwil source.
 * Supports wrapped/multi-line headers; all OCR output remains review-only.
 */
const KANWIL_SCREENSHOT_COLUMNS_V1 = [
 ['tanggal_pembayaran',['tanggal pembayaran']],['tanggal_mulai_verifikasi',['tanggal mulai verifikasi']],
 ['tanggal_auto_terbit',['tanggal auto terbit']],['layanan',['layanan']],['kategori_produk',['kategori produk']],
 ['nomor_permohonan',['nomor permohonan','no permohonan']],['tanggal_permohonan',['tanggal permohonan']],
 ['penjamin',['penjamin']],['nama',['nama']],['jenis_kelamin',['jenis kelamin']],['tanggal_lahir',['tanggal lahir']],
 ['kebangsaan',['kebangsaan']],['no_passport',['no passport','no. passport','nomor paspor','no paspor']],
 ['jenis_produk',['jenis produk']],['tujuan',['tujuan']],['posisi_permohonan',['posisi permohonan']],
 ['status_permohonan',['status permohonan']]
];
function kanwilShotNormalize_(v){return String(v==null?'':v).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\\s+/g,' ');}
function kanwilShotLines_(words,tolerance){
 const sorted=(words||[]).filter(w=>w&&w.bbox&&['x0','x1','y0','y1'].every(k=>Number.isFinite(w.bbox[k]))&&String(w.text||'').trim()).slice().sort((a,b)=>(a.bbox.y0+a.bbox.y1)-(b.bbox.y0+b.bbox.y1)||a.bbox.x0-b.bbox.x0);
 const lines=[];
 sorted.forEach(w=>{const cy=(w.bbox.y0+w.bbox.y1)/2;let line=lines.find(x=>Math.abs(x.cy-cy)<=tolerance);if(!line){line={cy,words:[]};lines.push(line);}line.words.push(w);line.cy=line.words.reduce((s,x)=>s+(x.bbox.y0+x.bbox.y1)/2,0)/line.words.length;});
 lines.sort((a,b)=>a.cy-b.cy);lines.forEach(l=>l.words.sort((a,b)=>a.bbox.x0-b.bbox.x0));return lines;
}
function kanwilShotMedian_(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:8;}
function kanwilShotHeaderClusters_(lines,start,end){
 const words=lines.slice(start,end+1).flatMap((line,lineOffset)=>line.words.map(w=>({...w,_line:start+lineOffset,_cx:(w.bbox.x0+w.bbox.x1)/2})));
 const heights=words.map(w=>w.bbox.y1-w.bbox.y0),tol=Math.max(8,kanwilShotMedian_(heights)*1.35);
 const clusters=[];
 words.sort((a,b)=>a.bbox.x0-b.bbox.x0||a.bbox.y0-b.bbox.y0).forEach(w=>{
  let best=null,bestDistance=Infinity;
  clusters.forEach(c=>{
   const gap=Math.max(0,Math.max(c.minX-w.bbox.x1,w.bbox.x0-c.maxX));
   if(gap<=tol&&gap<bestDistance){best=c;bestDistance=gap;}
  });
  if(!best){best={words:[],minX:w.bbox.x0,maxX:w.bbox.x1,cx:w._cx};clusters.push(best);}
  best.words.push(w);best.minX=Math.min(best.minX,w.bbox.x0);best.maxX=Math.max(best.maxX,w.bbox.x1);
  best.cx=best.words.reduce((sum,x)=>sum+x._cx,0)/best.words.length;
 });
 return clusters.map(c=>{const ordered=c.words.slice().sort((a,b)=>a._line-b._line||a.bbox.x0-b.bbox.x0);return {...c,text:ordered.map(w=>String(w.text).trim()).join(' '),lineStart:Math.min(...ordered.map(w=>w._line)),lineEnd:Math.max(...ordered.map(w=>w._line))};}).sort((a,b)=>a.cx-b.cx);
}
function kanwilShotHeaderMatch_(clusters){
 const aliases=KANWIL_SCREENSHOT_COLUMNS_V1.flatMap(([key,names])=>names.map(name=>({key,name:kanwilShotNormalize_(name)})));
 const matched=clusters.map(cluster=>{const normalized=kanwilShotNormalize_(cluster.text);const alias=aliases.find(a=>a.name===normalized);return {...cluster,key:alias?alias.key:null};});
 const keys=matched.filter(x=>x.key).map(x=>x.key);
 const missing=KANWIL_SCREENSHOT_COLUMNS_V1.map(x=>x[0]).filter(k=>!keys.includes(k));
 const duplicate=keys.filter((k,i)=>keys.indexOf(k)!==i);
 return {matched,missing,duplicate,score:keys.length};
}
function reconstructKanwilScreenshotTableV1(words,options){
 const opt=options||{},lines=kanwilShotLines_(words,Number.isFinite(opt.lineTolerance)?opt.lineTolerance:12);
 if(!lines.length)return {ok:false,reason:'NO_TEXT_WORDS',rows:[],header:[]};
 const maxHeaderLines=Math.max(2,Math.min(8,Number(opt.maxHeaderLines)||5));
 let best=null;
 for(let start=0;start<Math.min(lines.length,8);start++){
  for(let count=1;count<=maxHeaderLines&&start+count<=lines.length;count++){
   const clusters=kanwilShotHeaderClusters_(lines,start,start+count-1),match=kanwilShotHeaderMatch_(clusters);
   const candidate={start,end:start+count-1,clusters,...match};
   if(!best||candidate.score>best.score||(candidate.score===best.score&&candidate.missing.length<best.missing.length))best=candidate;
   if(candidate.score===17&&!candidate.duplicate.length){best=candidate;break;}
  }
  if(best&&best.score===17&&!best.duplicate.length)break;
 }
 if(!best||best.score!==17||best.missing.length||best.duplicate.length)
  return {ok:false,reason:'HEADER_MAPPING_INCOMPLETE_OR_AMBIGUOUS',missing:best?best.missing:KANWIL_SCREENSHOT_COLUMNS_V1.map(x=>x[0]),duplicate:best?best.duplicate:[],header:best?best.clusters.map(c=>c.text):[],matchedHeaderCount:best?best.score:0,rows:[]};
 const columns=best.matched.filter(x=>x.key).map(x=>({key:x.key,center:x.cx})).sort((a,b)=>a.center-b.center);
 const bounds=columns.map((c,i)=>({key:c.key,left:i?(columns[i-1].center+c.center)/2:-Infinity,right:i<columns.length-1?(c.center+columns[i+1].center)/2:Infinity}));
 const dataLines=lines.slice(best.end+1),rows=[];
 let current=null,sourceRowIndex=0;
 dataLines.forEach((line,lineIndex)=>{
  const buckets=Object.fromEntries(columns.map(c=>[c.key,[]]));
  line.words.forEach(w=>{const cx=(w.bbox.x0+w.bbox.x1)/2;const col=bounds.find(b=>cx>=b.left&&cx<b.right);if(col)buckets[col.key].push(w);});
  const values={},fieldEvidence={};
  Object.keys(buckets).forEach(key=>{const ws=buckets[key].sort((a,b)=>a.bbox.x0-b.bbox.x0);values[key]=ws.map(w=>String(w.text).trim()).filter(Boolean).join(' ')||null;fieldEvidence[key]=ws.length?{words:ws.map(w=>({text:String(w.text),confidence:Number.isFinite(w.confidence)?w.confidence:null,bbox:{...w.bbox}})),meanConfidence:ws.every(w=>Number.isFinite(w.confidence))?ws.reduce((s,w)=>s+w.confidence,0)/ws.length:null}:null;});
  const populated=Object.values(values).filter(v=>v!==null).length;
  if(!populated)return;
  const hasRecordStart=/^\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}/.test(String(values.tanggal_pembayaran||values.tanggal_mulai_verifikasi||'').trim());
  if(hasRecordStart||!current){sourceRowIndex++;current={sourceRowIndex,values:Object.fromEntries(columns.map(c=>[c.key,null])),fieldEvidence:{},warnings:['OCR_GEOMETRY_REQUIRES_HUMAN_REVIEW']};rows.push(current);}
  columns.forEach(c=>{if(values[c.key]){current.values[c.key]=[current.values[c.key],values[c.key]].filter(Boolean).join(' ');current.fieldEvidence[c.key]=fieldEvidence[c.key];}});
 });
 return {ok:true,reason:null,header:columns.map(c=>c.key),headerLineRange:[best.start,best.end],headerFragments:best.clusters.map(c=>({key:c.key,text:c.text,center:c.cx})),rows,warnings:['MULTILINE_HEADER_RECONSTRUCTED','NO_AUTO_COMMIT','VERIFY_EACH_CELL_AGAINST_SOURCE'],reviewRequired:true,autoCommit:false};
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_SCREENSHOT_COLUMNS_V1,reconstructKanwilScreenshotTableV1};
