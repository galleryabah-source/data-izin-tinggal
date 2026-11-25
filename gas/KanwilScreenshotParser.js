/** Dedicated OCR geometry parser for the 17-column Kanwil source.
 * Reconstructs wrapped headers from horizontal anchors and keeps all OCR review-only.
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
function kanwilShotNormalize_(v){
 return String(v==null?'':v).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function kanwilShotMedian_(values){
 const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
 return a.length?a[Math.floor(a.length/2)]:8;
}
function kanwilShotLines_(words,tolerance){
 const sorted=(words||[]).filter(w=>w&&w.bbox&&['x0','x1','y0','y1'].every(k=>Number.isFinite(w.bbox[k]))&&String(w.text||'').trim())
  .slice().sort((a,b)=>(a.bbox.y0+a.bbox.y1)-(b.bbox.y0+b.bbox.y1)||a.bbox.x0-b.bbox.x0);
 const lines=[];
 sorted.forEach(w=>{
  const cy=(w.bbox.y0+w.bbox.y1)/2;
  let line=lines.find(x=>Math.abs(x.cy-cy)<=tolerance);
  if(!line){line={cy,words:[]};lines.push(line);}
  line.words.push(w);line.cy=line.words.reduce((s,x)=>s+(x.bbox.y0+x.bbox.y1)/2,0)/line.words.length;
 });
 lines.sort((a,b)=>a.cy-b.cy);
 lines.forEach(l=>l.words.sort((a,b)=>a.bbox.x0-b.bbox.x0));
 return lines;
}
function kanwilShotHeaderFragments_(lines,start,end,wordGap){
 const fragments=[];
 for(let li=start;li<=end;li++){
  const words=lines[li].words;
  let current=null;
  words.forEach(w=>{
   const gap=current?Math.max(0,w.bbox.x0-current.x1):Infinity;
   if(!current||gap>wordGap){
    current={words:[],x0:w.bbox.x0,x1:w.bbox.x1,line:li};
    fragments.push(current);
   }
   current.words.push(w);current.x1=Math.max(current.x1,w.bbox.x1);
  });
 }
 return fragments.map(f=>({...f,text:f.words.map(w=>String(w.text).trim()).join(' ')}));
}
function kanwilShotHeaderClusters_(lines,start,end){
 const allWords=lines.slice(start,end+1).flatMap(l=>l.words);
 const medianHeight=kanwilShotMedian_(allWords.map(w=>w.bbox.y1-w.bbox.y0));
 const fragments=kanwilShotHeaderFragments_(lines,start,end,Math.max(8,medianHeight*1.45));
 // Header text is frequently centered or indented within its cell. A narrow
 // x tolerance splits wrapped labels ("Tanggal" / "Pembayaran") into separate
 // pseudo-columns. Keep a stable left-edge anchor and allow a wider, bounded
 // tolerance while remaining below the normal inter-column gap.
 const xTolerance=Math.max(22,Math.min(58,medianHeight*3.8));
 const clusters=[];
 fragments.sort((a,b)=>a.x0-b.x0||a.line-b.line).forEach(fragment=>{
  let best=null,distance=Infinity;
  clusters.forEach(cluster=>{
   const d=Math.abs(fragment.x0-cluster.anchor);
   if(d<=xTolerance&&d<distance){best=cluster;distance=d;}
  });
  if(!best){
   best={fragments:[],anchor:fragment.x0};
   clusters.push(best);
  }
  best.fragments.push(fragment);
  // Use the left-most observed fragment as the stable anchor. A median drifts
  // when one wrapped header line is centered or starts after a short first word.
  best.anchor=Math.min(...best.fragments.map(f=>f.x0));
 });
 return clusters.map(c=>{
  const ordered=c.fragments.slice().sort((a,b)=>a.line-b.line||a.x0-b.x0);
  return {text:ordered.map(f=>f.text).join(' '),anchor:c.anchor,
   lineStart:Math.min(...ordered.map(f=>f.line)),lineEnd:Math.max(...ordered.map(f=>f.line))};
 }).sort((a,b)=>a.anchor-b.anchor);
}
function kanwilShotHeaderMatch_(clusters){
 const aliases=KANWIL_SCREENSHOT_COLUMNS_V1.flatMap(([key,names])=>names.map(name=>({key,name:kanwilShotNormalize_(name)})));
 const matched=clusters.map(cluster=>{
  const normalized=kanwilShotNormalize_(cluster.text);
  const tokens=normalized.split(' ').filter(Boolean);
  const alias=aliases.find(a=>a.name===normalized)||
   aliases.find(a=>normalized.includes(a.name))||
   aliases.find(a=>{
    const expected=a.name.split(' ').filter(Boolean);
    if(expected.length!==tokens.length)return false;
    const overlap=expected.filter((token,i)=>token===tokens[i]).length;
    return overlap/Math.max(1,expected.length)>=0.75;
   });
  return {...cluster,key:alias?alias.key:null};
 });
 const keys=matched.filter(x=>x.key).map(x=>x.key);
 const missing=KANWIL_SCREENSHOT_COLUMNS_V1.map(x=>x[0]).filter(k=>!keys.includes(k));
 const duplicate=keys.filter((k,i)=>keys.indexOf(k)!==i);
 return {matched,missing,duplicate,score:keys.length};
}
function reconstructKanwilScreenshotTableV1(words,options){
 const opt=options||{};
 const lines=kanwilShotLines_(words,Number.isFinite(opt.lineTolerance)?opt.lineTolerance:12);
 if(!lines.length)return {ok:false,reason:'NO_TEXT_WORDS',rows:[],header:[]};
 const maxHeaderLines=Math.max(2,Math.min(8,Number(opt.maxHeaderLines)||6));
 let best=null;
 for(let start=0;start<Math.min(lines.length,10);start++){
  for(let count=1;count<=maxHeaderLines&&start+count<=lines.length;count++){
   const clusters=kanwilShotHeaderClusters_(lines,start,start+count-1);
   const match=kanwilShotHeaderMatch_(clusters);
   const candidate={start,end:start+count-1,clusters,...match};
   if(!best||candidate.score>best.score||(candidate.score===best.score&&candidate.missing.length<best.missing.length))best=candidate;
   if(candidate.score===17&&!candidate.duplicate.length){best=candidate;break;}
  }
  if(best&&best.score===17&&!best.duplicate.length)break;
 }
 if(!best||best.score!==17||best.missing.length||best.duplicate.length){
  return {ok:false,reason:'HEADER_MAPPING_INCOMPLETE_OR_AMBIGUOUS',
   missing:best?best.missing:KANWIL_SCREENSHOT_COLUMNS_V1.map(x=>x[0]),
   duplicate:best?best.duplicate:[],header:best?best.clusters.map(c=>c.text):[],
   matchedHeaderCount:best?best.score:0,
   headerDiagnostics:best?best.clusters.map(c=>({text:c.text,anchor:Math.round(c.anchor),key:c.key||null,lineStart:c.lineStart,lineEnd:c.lineEnd})):[],
   rows:[],reviewRequired:true,autoCommit:false};
 }
 const columns=best.matched.filter(x=>x.key).map(x=>({key:x.key,anchor:x.anchor})).sort((a,b)=>a.anchor-b.anchor);
 const bounds=columns.map((c,i)=>({
  key:c.key,left:i?(columns[i-1].anchor+c.anchor)/2:-Infinity,
  right:i<columns.length-1?(c.anchor+columns[i+1].anchor)/2:Infinity
 }));
 const rows=[];
 let current=null,sourceRowIndex=0;
 lines.slice(best.end+1).forEach(line=>{
  const buckets=Object.fromEntries(columns.map(c=>[c.key,[]]));
  line.words.forEach(w=>{
   // OCR boxes can extend across the visual midpoint of a narrow column (e.g. the
   // second token in a two-word name). Assign by the token's left edge with a
   // small font-height correction; midpoint ties remain in the preceding column.
   const x=w.bbox.x0-Math.max(3,(w.bbox.y1-w.bbox.y0)*0.4);
   const col=bounds.find(b=>x>=b.left&&x<=b.right);
   if(col)buckets[col.key].push(w);
  });
  const values={},fieldEvidence={};
  Object.keys(buckets).forEach(key=>{
   const ws=buckets[key].sort((a,b)=>a.bbox.x0-b.bbox.x0);
   values[key]=ws.map(w=>String(w.text).trim()).filter(Boolean).join(' ')||null;
   fieldEvidence[key]=ws.length?{
    words:ws.map(w=>({text:String(w.text),confidence:Number.isFinite(w.confidence)?w.confidence:null,bbox:{...w.bbox}})),
    meanConfidence:ws.every(w=>Number.isFinite(w.confidence))?ws.reduce((s,w)=>s+w.confidence,0)/ws.length:null
   }:null;
  });
  if(!Object.values(values).some(v=>v!==null))return;
  const firstDate=String(values.tanggal_pembayaran||'').trim();
  const hasRecordStart=/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(firstDate);
  if(hasRecordStart||!current){
   sourceRowIndex++;
   current={sourceRowIndex,values:Object.fromEntries(columns.map(c=>[c.key,null])),
    fieldEvidence:{},warnings:['OCR_GEOMETRY_REQUIRES_HUMAN_REVIEW']};
   rows.push(current);
  }
  columns.forEach(c=>{
   if(values[c.key]){
    current.values[c.key]=[current.values[c.key],values[c.key]].filter(Boolean).join(' ');
    current.fieldEvidence[c.key]=fieldEvidence[c.key];
   }
  });
 });
 return {
  ok:true,reason:null,header:columns.map(c=>c.key),headerLineRange:[best.start,best.end],
  headerFragments:best.matched.map(c=>({key:c.key,text:c.text,anchor:c.anchor})),
  rows,warnings:['MULTILINE_HEADER_RECONSTRUCTED','NO_AUTO_COMMIT','VERIFY_EACH_CELL_AGAINST_SOURCE'],
  reviewRequired:true,autoCommit:false
 };
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_SCREENSHOT_COLUMNS_V1,reconstructKanwilScreenshotTableV1};
