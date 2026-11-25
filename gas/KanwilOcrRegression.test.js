const assert=require('assert');
const {KANWIL_SCREENSHOT_COLUMNS_V1,reconstructKanwilScreenshotTableV1}=require('./KanwilScreenshotParser');
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
console.log('Kanwil OCR realistic multiline-header tests: PASS');
