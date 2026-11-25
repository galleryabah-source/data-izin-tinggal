/** Dedicated OCR geometry parser for the 17-column Kanwil source.
 * Reconstructs wrapped headers from horizontal anchors and keeps all OCR review-only.
 */
const KANWIL_SCREENSHOT_COLUMNS_V1 = [
 ['tanggal_pembayaran',['tanggal pembayaran']],['tanggal_mulai_verifikasi',['tanggal mulai verifikasi']],
 ['tanggal_auto_terbit',['tanggal auto terbit']],['layanan',['layanan']],['kategori_produk',['kategori produk']],
 ['nomor_permohonan',['nomor permohonan','no permohonan']],['tanggal_permohonan',['tanggal permohonan','tanggal permoh']],
 ['penjamin',['penjamin','penjami']],['nama',['nama']],['jenis_kelamin',['jenis kelamin']],['tanggal_lahir',['tanggal lahir']],
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

function kanwilShotMergeKnownHeaderFragments_(fragments){
 const aliases=new Set(KANWIL_SCREENSHOT_COLUMNS_V1.flatMap(([,names])=>names.map(kanwilShotNormalize_)));
 const merged=[];
 for(let i=0;i<fragments.length;){
  let match=null,matchLength=0;
  // OCR may split a single multi-word heading into separate boxes on the same
  // visual line. Merge only when the joined text is an exact canonical alias;
  // this cannot combine the adjacent "Posisi Permohonan" and "Status Permohonan"
  // columns because "Permohonan Permohonan" is not a valid alias.
  for(let count=2;count<=3&&i+count<=fragments.length;count++){
   const part=fragments.slice(i,i+count);
   const text=part.map(x=>x.text).join(' ');
   if(aliases.has(kanwilShotNormalize_(text))){
    match={...part[0],x1:part[part.length-1].x1,
     words:part.flatMap(x=>x.words||[]),text};
    matchLength=count;
   }
  }
  if(match){merged.push(match);i+=matchLength;}
  else{merged.push(fragments[i]);i++;}
 }
 return merged;
}
function kanwilShotHeaderClusters_(lines,start,end){
 const allWords=lines.slice(start,end+1).flatMap(l=>l.words);
 const medianHeight=kanwilShotMedian_(allWords.map(w=>w.bbox.y1-w.bbox.y0));
 // Keep OCR words as small fragments here. A wide word-gap threshold can
 // merge the last word of one narrow header with the next column's first word
 // (notably "Posisi Permohonan" beside "Status Permohonan").
 const wordGap=Math.max(3,medianHeight*0.65);
 const perLine=[];
 for(let li=start;li<=end;li++){
  const fragments=kanwilShotMergeKnownHeaderFragments_(kanwilShotHeaderFragments_(lines,li,li,wordGap)).map(f=>({...f,line:li}));
  perLine.push({line:li,fragments});
 }
 // Header cells are vertically staggered in the real Kanwil table:
 // each label wraps independently, so no single OCR text line is guaranteed
 // to contain all 17 columns. Infer anchors from the x-coordinates of every
 // header fragment, grouping wrapped tokens that share a column start.
 // The minimum inter-column gap in this table is much larger than normal
 // within-cell indentation; a bounded x cluster therefore preserves adjacent
 // columns while tolerating OCR box jitter and wrapped-token indentation.
 const allFragments=perLine.flatMap(entry=>entry.fragments).slice().sort((a,b)=>a.x0-b.x0||a.line-b.line);
 const anchorTolerance=Math.max(10,medianHeight*3.5);
 const anchorGroups=[];
 allFragments.forEach(fragment=>{
  let group=anchorGroups[anchorGroups.length-1];
  if(!group||fragment.x0-group.minX>anchorTolerance){
   group={minX:fragment.x0,fragments:[]};
   anchorGroups.push(group);
  }
  group.fragments.push(fragment);
 });
 // Preserve partial groups so failed mappings expose the actual OCR geometry.
 const anchors=anchorGroups.map(group=>group.minX);
 if(anchors.some((x,i)=>i&&x<=anchors[i-1]))return [];
 const clusters=anchors.map(anchor=>({anchor,fragments:[]}));
 perLine.forEach(entry=>entry.fragments.forEach(fragment=>{
  let nearest=-1,distance=Infinity;
  anchors.forEach((anchor,i)=>{
   const d=Math.abs(fragment.x0-anchor);
   if(d<distance){distance=d;nearest=i;}
  });
  const leftGap=nearest>0?anchors[nearest]-anchors[nearest-1]:Infinity;
  const rightGap=nearest<anchors.length-1?anchors[nearest+1]-anchors[nearest]:Infinity;
  const localGap=Math.min(leftGap,rightGap);
  const tolerance=Number.isFinite(localGap)?Math.max(medianHeight*1.5,localGap*0.46):medianHeight*2.5;
  if(distance<=tolerance)clusters[nearest].fragments.push(fragment);
 }));
 return clusters.map(c=>{
  const ordered=c.fragments.slice().sort((a,b)=>a.line-b.line||a.x0-b.x0);
  return {text:ordered.map(f=>f.text).join(' '),anchor:c.anchor,anchorGroupCount:anchors.length,
   lineStart:ordered.length?Math.min(...ordered.map(f=>f.line)):start,
   lineEnd:ordered.length?Math.max(...ordered.map(f=>f.line)):end};
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
   anchorGroupCount:best?best.clusters.length:0,candidateLineCount:best?best.end-best.start+1:0,inputWordCount:Array.isArray(words)?words.length:0,
   rows:[],reviewRequired:true,autoCommit:false};
 }
 const columns=best.matched.filter(x=>x.key).map(x=>({key:x.key,anchor:x.anchor})).sort((a,b)=>a.anchor-b.anchor);
 const minX=Math.min(...words.map(w=>w.bbox.x0)),maxX=Math.max(...words.map(w=>w.bbox.x1));
 const bounds=columns.map((col,i)=>({
  key:col.key,left:i?(columns[i-1].anchor+col.anchor)/2:minX,
  right:i<columns.length-1?(col.anchor+columns[i+1].anchor)/2:maxX
 }));
 const dataLines=lines.slice(best.end+1);
 const lineBuckets=dataLines.map((line,index)=>{
  const buckets=Object.fromEntries(columns.map(col=>[col.key,[]]));
  line.words.forEach(w=>{
   const x=w.bbox.x0-Math.max(3,(w.bbox.y1-w.bbox.y0)*0.4);
   const col=bounds.find(b=>x>=b.left&&x<=b.right);
   if(col)buckets[col.key].push(w);
  });
  const paymentText=(buckets.tanggal_pembayaran||[]).map(w=>String(w.text)).join(' ').trim();
  return {index,line,buckets,paymentText,hasDateAnchor:/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/.test(paymentText)};
 });
 const gaps=[];
 for(let i=1;i<dataLines.length;i++)gaps.push(Math.max(0,dataLines[i].cy-dataLines[i-1].cy));
 let geometryThreshold=null,geometryConfidence='LOW';
 if(gaps.length>=4){
  let low=Math.min(...gaps),high=Math.max(...gaps);
  for(let iteration=0;iteration<12;iteration++){
   const lower=gaps.filter(g=>Math.abs(g-low)<=Math.abs(g-high));
   const upper=gaps.filter(g=>Math.abs(g-low)>Math.abs(g-high));
   if(!lower.length||!upper.length)break;
   const nextLow=lower.reduce((s,v)=>s+v,0)/lower.length;
   const nextHigh=upper.reduce((s,v)=>s+v,0)/upper.length;
   if(Math.abs(nextLow-low)<0.01&&Math.abs(nextHigh-high)<0.01)break;
   low=nextLow;high=nextHigh;
  }
  const lowerCount=gaps.filter(g=>Math.abs(g-low)<=Math.abs(g-high)).length;
  const upperCount=gaps.length-lowerCount;
  if(upperCount>=2&&lowerCount>=2&&high>=low*1.45){
   geometryThreshold=(low+high)/2;geometryConfidence='HIGH';
  }
 }
 const boundaries=[0],boundaryEvidence=[];
 for(let i=1;i<lineBuckets.length;i++){
  const gap=Math.max(0,lineBuckets[i].line.cy-lineBuckets[i-1].line.cy);
  const verticalBoundary=geometryThreshold!==null&&gap>geometryThreshold;
  const dateBoundary=lineBuckets[i].hasDateAnchor;
  if(verticalBoundary||dateBoundary){
   boundaries.push(i);
   boundaryEvidence.push({lineIndex:i,gapBefore:gap,verticalBoundary,dateBoundary});
  }
 }
 if(lineBuckets.length&&boundaries.length===1&&!lineBuckets.some(x=>x.hasDateAnchor)){
  for(let i=1;i<lineBuckets.length;i++)boundaries.push(i);
  geometryConfidence='AMBIGUOUS';
 }
 const rowGroups=[];
 boundaries.forEach((startIndex,i)=>{
  const endIndex=(boundaries[i+1]??lineBuckets.length)-1;
  if(endIndex<startIndex)return;
  const groupLines=lineBuckets.slice(startIndex,endIndex+1);
  const before=boundaryEvidence.find(x=>x.lineIndex===startIndex)||null;
  rowGroups.push({
   startIndex,endIndex,lines:groupLines,
   yStart:Math.min(...groupLines.map(x=>Math.min(...x.line.words.map(w=>w.bbox.y0)))),
   yEnd:Math.max(...groupLines.map(x=>Math.max(...x.line.words.map(w=>w.bbox.y1)))),
   gapBefore:before?before.gapBefore:null,
   boundaryReason:before?(before.verticalBoundary&&before.dateBoundary?'VERTICAL_GAP_AND_DATE_ANCHOR':before.verticalBoundary?'VERTICAL_GAP':'DATE_ANCHOR'):'FIRST_DATA_BAND'
  });
 });
 const dateKeys=new Set(['tanggal_pembayaran','tanggal_mulai_verifikasi','tanggal_auto_terbit','tanggal_permohonan','tanggal_lahir']);
 function validateCell(key,value,evidence){
  const flags=[];
  if(!value){
   flags.push(key==='nomor_permohonan'||key==='nama'?'REQUIRED_CELL_EMPTY':'CELL_EMPTY_OPTIONAL');
   return flags;
  }
  if(evidence&&Number.isFinite(evidence.meanConfidence)&&evidence.meanConfidence<65)flags.push('CELL_LOW_CONFIDENCE');
  if(evidence&&evidence.bbox&&evidence.columnBounds){
   if(evidence.bbox.x0<evidence.columnBounds.left-2||evidence.bbox.x1>evidence.columnBounds.right+2)flags.push('CELL_CROSSES_COLUMN_BOUNDARY');
   else if(evidence.bbox.x0<=evidence.columnBounds.left+2||evidence.bbox.x1>=evidence.columnBounds.right-2)flags.push('CELL_NEAR_COLUMN_BOUNDARY');
  }
  if(/[-–—]$/.test(value.trim())||(evidence&&evidence.bbox&&evidence.columnBounds&&evidence.bbox.x1>=evidence.columnBounds.right-1))flags.push('POSSIBLE_TEXT_TRUNCATION');
  if(dateKeys.has(key)&&! /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.test(value.trim()))
   flags.push('DATE_FORMAT_REQUIRES_REVIEW','POSSIBLE_COLUMN_SHIFT');
  if(key==='nomor_permohonan'&&!/^[A-Z0-9-]{8,24}$/i.test(value.replace(/\s+/g,'')))flags.push('APPLICATION_NUMBER_FORMAT_REQUIRES_REVIEW','POSSIBLE_COLUMN_SHIFT');
  if(key==='jenis_kelamin'&&!/^(MALE|FEMALE|LAKI[\s-]?LAKI|PEREMPUAN)$/i.test(value.trim()))flags.push('GENDER_VALUE_REQUIRES_REVIEW','POSSIBLE_COLUMN_SHIFT');
  if(key==='no_passport'&&!/^[A-Z0-9]{5,15}$/i.test(value.replace(/\s+/g,'')))flags.push('PASSPORT_FORMAT_REQUIRES_REVIEW','POSSIBLE_COLUMN_SHIFT');
  return flags;
 }
 const rows=[];
 rowGroups.forEach((group,index)=>{
  const cellWords=Object.fromEntries(columns.map(col=>[col.key,[]]));
  group.lines.forEach(item=>Object.keys(item.buckets).forEach(key=>cellWords[key].push(...item.buckets[key])));
  const values={},fieldEvidence={},validationWarnings=[],validationErrors=[];
  columns.forEach(col=>{
   const key=col.key,ws=cellWords[key].slice().sort((a,b)=>(a.bbox.y0+a.bbox.y1)-(b.bbox.y0+b.bbox.y1)||a.bbox.x0-b.bbox.x0);
   const value=ws.map(w=>String(w.text).trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
   values[key]=value||null;
   const bbox=ws.length?{x0:Math.min(...ws.map(w=>w.bbox.x0)),y0:Math.min(...ws.map(w=>w.bbox.y0)),x1:Math.max(...ws.map(w=>w.bbox.x1)),y1:Math.max(...ws.map(w=>w.bbox.y1))}:null;
   const columnBounds=bounds.find(b=>b.key===key);
   const cellEvidence={
    cellStatus:ws.length?'CAPTURED':'EMPTY',bbox,columnBounds:{left:columnBounds.left,right:columnBounds.right},
    wordCount:ws.length,words:ws.map(w=>({text:String(w.text),confidence:Number.isFinite(w.confidence)?w.confidence:null,bbox:{...w.bbox}})),
    meanConfidence:ws.length&&ws.every(w=>Number.isFinite(w.confidence))?ws.reduce((sum,w)=>sum+w.confidence,0)/ws.length:null,
    reviewFlags:[]
   };
   cellEvidence.reviewFlags=validateCell(key,value,cellEvidence);
   if(cellEvidence.reviewFlags.length){
    cellEvidence.cellStatus=ws.length?'REVIEW':'EMPTY';
    cellEvidence.reviewFlags.filter(code=>code!=='CELL_EMPTY_OPTIONAL').forEach(code=>validationWarnings.push({field:key,code}));
   }
   fieldEvidence[key]=cellEvidence;
  });
  ['nomor_permohonan','nama'].forEach(key=>{if(!values[key])validationErrors.push({field:key,code:'REQUIRED_CELL_EMPTY'});});
  const rowWarnings=['OCR_GEOMETRY_REQUIRES_HUMAN_REVIEW'];
  if(geometryConfidence==='AMBIGUOUS')rowWarnings.push('ROW_GEOMETRY_AMBIGUOUS');
  if(validationWarnings.length)rowWarnings.push('CELL_VALIDATION_WARNINGS');
  rows.push({
   sourceRowIndex:index+1,values,fieldEvidence,validationErrors,validationWarnings,
   rowGeometry:{yStart:group.yStart,yEnd:group.yEnd,lineCount:group.lines.length,gapBefore:group.gapBefore,
    boundaryReason:group.boundaryReason,
    segmentationMethod:geometryConfidence==='HIGH'?'VERTICAL_GAP_CLUSTERING_WITH_DATE_ANCHORS':
     (lineBuckets.some(x=>x.hasDateAnchor)?'DATE_ANCHORS_WITH_VERTICAL_GAP_CHECK':'LINE_BASELINE_FALLBACK'),
    confidence:geometryConfidence},
   warnings:rowWarnings,reviewRequired:true,autoCommit:false
  });
 });
 const rowSegmentation={
  method:geometryConfidence==='HIGH'?'VERTICAL_GAP_CLUSTERING_WITH_DATE_ANCHORS':
   (lineBuckets.some(x=>x.hasDateAnchor)?'DATE_ANCHORS_WITH_VERTICAL_GAP_CHECK':'LINE_BASELINE_FALLBACK'),
  confidence:geometryConfidence,verticalGapThreshold:geometryThreshold,dataLineCount:dataLines.length,
  candidateRowCount:rows.length,sourceRowCountVerified:false,
  sourceRowCountEvidence:'UNAVAILABLE_FROM_OCR_WORD_GEOMETRY'
 };

 return {
  ok:true,reason:null,header:columns.map(c=>c.key),headerLineRange:[best.start,best.end],
  matchedHeaderCount:best.score,anchorGroupCount:best.clusters.length,
  candidateLineCount:best.end-best.start+1,inputWordCount:Array.isArray(words)?words.length:0,
  missing:[],duplicate:[],
  headerDiagnostics:best.clusters.map(c=>({text:c.text,anchor:Math.round(c.anchor),key:c.key||null,lineStart:c.lineStart,lineEnd:c.lineEnd})),
  headerFragments:best.matched.map(c=>({key:c.key,text:c.text,anchor:c.anchor})),
  rowSegmentation,rows,warnings:['MULTILINE_HEADER_RECONSTRUCTED','NO_AUTO_COMMIT','VERIFY_EACH_CELL_AGAINST_SOURCE'],
  reviewRequired:true,autoCommit:false,sourceRowCountVerified:false
 };
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_SCREENSHOT_COLUMNS_V1,reconstructKanwilScreenshotTableV1};
