const assert=require('assert');
const {KANWIL_SCREENSHOT_COLUMNS_V1,reconstructKanwilScreenshotTableV1}=require('../gas/KanwilScreenshotParser');
const words=[];
const y0=12, lineH=17, colX=[8,112,207,289,380,463,568,675,762,868,944,1024,1120,1200,1338,1428,1520];
// Realistic wrapped headers: words within one header cell have normal word gaps,
// and wrapped words align near the same left edge across multiple OCR lines.
KANWIL_SCREENSHOT_COLUMNS_V1.forEach(([key,aliases],col)=>{
 const tokens=aliases[0].split(' ');
 tokens.forEach((token,row)=>{
  const x=colX[col]+(row===0?0:2);
  const width=token.length*6.4;
  words.push({text:token,confidence:95,bbox:{x0:x,y0:y0+row*lineH,x1:x+width,y1:y0+row*lineH+13}});
 });
});
const dataY=130;
const sample=['2026-11-17','2026-11-23','2026-11-23','CONVERSION ITAP','ITAP','171126046899','2026-11-17 13:30:43','LINDA EFFENDI','MEHMET UZELE','MALE','1980-06-05','TURKI','U37234274','ITASITAP_SPOUSEIND','FAMILY','Produk sudah Terbit','TERBIT'];
sample.forEach((value,col)=>{
 if(col===8){words.push({text:'MEHMET',confidence:91,bbox:{x0:colX[col],y0:dataY,x1:colX[col]+45,y1:dataY+14}});return;}
 const x=colX[col],width=Math.min(value.length*5.8,Math.max(35,(colX[col+1]||1600)-x-8));
 words.push({text:value,confidence:91,bbox:{x0:x,y0:dataY,x1:x+width,y1:dataY+14}});
});
// The second token begins almost at the midpoint between Nama and Jenis Kelamin.
// It must remain part of Nama rather than being shifted into the gender column.
words.push({text:'UZELE',confidence:89,bbox:{x0:818,y0:dataY,x1:851,y1:dataY+14}});
const result=reconstructKanwilScreenshotTableV1(words,{lineTolerance:8,maxHeaderLines:6});
assert.strictEqual(result.ok,true,'wrapped headers should map all 17 columns: '+JSON.stringify({missing:result.missing,header:result.header}));
assert.strictEqual(result.header.length,17);
assert.strictEqual(result.rows.length,1);
assert.strictEqual(result.rows[0].values.nomor_permohonan,'171126046899');
assert.strictEqual(result.rows[0].values.nama,'MEHMET UZELE','wrapped name token remains in Nama column');
assert.strictEqual(result.rows[0].values.jenis_kelamin,'MALE','gender remains in its own column');
assert.strictEqual(result.rows[0].values.no_passport,'U37234274');
assert.strictEqual(result.autoCommit,false);
assert.strictEqual(result.reviewRequired,true);
assert.strictEqual('tanggal pembayaran'.replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '),'tanggal pembayaran','whitespace normalization is correct');
// Regression: OCR boxes for wrapped header fragments may be horizontally indented
// by the browser's centered header layout. They must still resolve to the same column.
const indentedWords=[];
const offsets=[0,24,31,18,27,34,22,29,16,25,32,20,28,35,23,30,17];
KANWIL_SCREENSHOT_COLUMNS_V1.forEach(([key,aliases],col)=>{
 aliases[0].split(' ').forEach((token,row)=>{
  const x=colX[col]+(row===0?0:offsets[col]);
  const y=y0+row*lineH;
  indentedWords.push({text:token,confidence:93,bbox:{x0:x,y0:y,x1:x+token.length*6.2,y1:y+13}});
 });
});
const indentedResult=reconstructKanwilScreenshotTableV1(indentedWords,{lineTolerance:8,maxHeaderLines:6});
assert.strictEqual(indentedResult.ok,true,'indented multiline headers should remain in their source column: '+JSON.stringify({missing:indentedResult.missing,diagnostics:indentedResult.headerDiagnostics}));
assert.strictEqual(indentedResult.header.length,17);
assert.deepStrictEqual(indentedResult.header, KANWIL_SCREENSHOT_COLUMNS_V1.map(([key])=>key),'all 17 columns must retain canonical order');
assert.ok(indentedResult.headerFragments.some(x=>x.key==='posisi_permohonan'&&x.text==='posisi permohonan'));
assert.ok(indentedResult.headerFragments.some(x=>x.key==='status_permohonan'&&x.text==='status permohonan'));


// Regression: a single multi-word heading can be split into separate OCR boxes
// on the same visual line. The parser must merge only an exact known alias.
const splitAliasWords=[];
KANWIL_SCREENSHOT_COLUMNS_V1.forEach(([key,aliases],col)=>{
 const tokens=aliases[0].split(' ');
 tokens.forEach((token,row)=>{
  const x=colX[col]+(row===0?0:2);
  const y=y0+row*lineH;
  const width=token.length*6.2;
  if(col===13&&row===1){
   splitAliasWords.push({text:token,confidence:92,bbox:{x0:colX[col]+tokens[0].length*6.2+14,y0:y0,x1:colX[col]+tokens[0].length*6.2+14+width,y1:y0+13}});
  }else if(col!==13){
   splitAliasWords.push({text:token,confidence:92,bbox:{x0:x,y0:y,x1:x+width,y1:y+13}});
  }else{
   splitAliasWords.push({text:token,confidence:92,bbox:{x0:x,y0:y0,x1:x+width,y1:y0+13}});
  }
 });
});
const splitAliasResult=reconstructKanwilScreenshotTableV1(splitAliasWords,{lineTolerance:8,maxHeaderLines:6});
assert.strictEqual(splitAliasResult.ok,true,'same-line split alias should map 17 columns: '+JSON.stringify({missing:splitAliasResult.missing,diagnostics:splitAliasResult.headerDiagnostics}));
assert.strictEqual(splitAliasResult.header.length,17);
assert.ok(splitAliasResult.headerFragments.some(x=>x.key==='jenis_produk'&&x.text==='jenis produk'));
assert.ok(splitAliasResult.headerFragments.some(x=>x.key==='posisi_permohonan'&&x.text==='posisi permohonan'));
assert.ok(splitAliasResult.headerFragments.some(x=>x.key==='status_permohonan'&&x.text==='status permohonan'));


// Regression: the real Kanwil table staggers header cells vertically, so no
// single OCR line contains all 17 column starts. Anchors must be inferred
// across the complete multi-line header region.
const staggeredHeaderWords=[];
KANWIL_SCREENSHOT_COLUMNS_V1.forEach(([key,aliases],col)=>{
 const tokens=aliases[0].split(' ');
 tokens.forEach((token,row)=>{
  const x=colX[col]+(row===0?0:2);
  const y=y0+(col%3)*17+row*17;
  staggeredHeaderWords.push({text:token,confidence:94,bbox:{x0:x,y0:y,x1:x+token.length*6.2,y1:y+13}});
 });
});
const staggeredResult=reconstructKanwilScreenshotTableV1(staggeredHeaderWords,{lineTolerance:8,maxHeaderLines:6});
assert.strictEqual(staggeredResult.ok,true,'vertically staggered headers should map all 17 columns: '+JSON.stringify({missing:staggeredResult.missing,diagnostics:staggeredResult.headerDiagnostics}));
assert.strictEqual(staggeredResult.header.length,17);
assert.deepStrictEqual(staggeredResult.header,KANWIL_SCREENSHOT_COLUMNS_V1.map(([key])=>key),'staggered headers must retain canonical order');
assert.ok(staggeredResult.headerFragments.some(x=>x.key==='tanggal_mulai_verifikasi'&&x.text==='tanggal mulai verifikasi'));
assert.ok(staggeredResult.headerFragments.some(x=>x.key==='posisi_permohonan'&&x.text==='posisi permohonan'));
assert.ok(staggeredResult.headerFragments.some(x=>x.key==='status_permohonan'&&x.text==='status permohonan'));
assert.strictEqual(staggeredResult.autoCommit,false);
assert.strictEqual(staggeredResult.reviewRequired,true);

console.log('Kanwil OCR realistic multiline-header tests: PASS');


// Regression: browser OCR can truncate the final glyphs in narrow header cells.
// These aliases are intentionally confined to screenshot OCR, not the CSV contract.
const truncatedHeaderWords=[];
KANWIL_SCREENSHOT_COLUMNS_V1.forEach(([key,aliases],col)=>{
 const header=key==='tanggal_permohonan'?'tanggal permoh':key==='penjamin'?'penjami':aliases[0];
 header.split(' ').forEach((token,row)=>{
  const x=colX[col]+(row===0?0:2);
  const y=y0+(col%3)*17+row*17;
  truncatedHeaderWords.push({text:token,confidence:88,bbox:{x0:x,y0:y,x1:x+token.length*6.2,y1:y+13}});
 });
});
// A sort indicator can be OCR'd as a stray punctuation fragment between columns.
truncatedHeaderWords.push({text:'~',confidence:20,bbox:{x0:colX[1]-45,y0:y0+17,x1:colX[1]-39,y1:y0+22}});
const truncatedHeaderResult=reconstructKanwilScreenshotTableV1(truncatedHeaderWords,{lineTolerance:8,maxHeaderLines:6});
assert.strictEqual(truncatedHeaderResult.ok,true,'truncated narrow header labels should map all 17 columns: '+JSON.stringify({missing:truncatedHeaderResult.missing,diagnostics:truncatedHeaderResult.headerDiagnostics}));
assert.deepStrictEqual(truncatedHeaderResult.header,KANWIL_SCREENSHOT_COLUMNS_V1.map(([key])=>key),'truncated OCR labels must preserve the canonical 17-column order');
assert.ok(truncatedHeaderResult.headerFragments.some(x=>x.key==='tanggal_permohonan'&&x.text==='tanggal permoh'));
assert.ok(truncatedHeaderResult.headerFragments.some(x=>x.key==='penjamin'&&x.text==='penjami'));
assert.strictEqual(truncatedHeaderResult.autoCommit,false);
