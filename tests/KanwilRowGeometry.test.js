const assert=require('assert');
const {KANWIL_SCREENSHOT_COLUMNS_V1,reconstructKanwilScreenshotTableV1}=require('../gas/KanwilScreenshotParser');
const x=[8,112,207,289,380,463,568,675,762,868,944,1024,1120,1200,1338,1428,1520];
const words=[];
KANWIL_SCREENSHOT_COLUMNS_V1.forEach(([key,aliases],col)=>{
 aliases[0].split(' ').forEach((token,row)=>{
  const left=x[col]+(row?2:0),top=10+row*15;
  words.push({text:token,confidence:94,bbox:{x0:left,y0:top,x1:left+token.length*6.1,y1:top+11}});
 });
});
const records=[
 {app:'171126046899',name:'MEHMET UZELE',gender:'MALE',passport:'U37234274'},
 {app:'161126042545',name:'YOHANES BONAR',gender:'FEMALE',passport:'RA4704941'},
 {app:'161126043599',name:'MUHAMMED CAKIR',gender:'MALE',passport:'U35307946'}
];
records.forEach((record,index)=>{
 const top=100+index*60;
 words.push({text:record.app,confidence:93,bbox:{x0:x[5],y0:top,x1:x[5]+72,y1:top+11}});
 words.push({text:record.name.split(' ')[0],confidence:91,bbox:{x0:x[8],y0:top,x1:x[8]+52,y1:top+11}});
 words.push({text:record.name.split(' ')[1],confidence:91,bbox:{x0:x[8]+56,y0:top+15,x1:x[8]+98,y1:top+26}});
 words.push({text:record.gender,confidence:93,bbox:{x0:x[9],y0:top+15,x1:x[9]+35,y1:top+26}});
 words.push({text:record.passport,confidence:93,bbox:{x0:x[12],y0:top+15,x1:x[12]+60,y1:top+26}});
});
const result=reconstructKanwilScreenshotTableV1(words,{lineTolerance:8,maxHeaderLines:6});
assert.strictEqual(result.ok,true,'header reconstruction should pass');
assert.strictEqual(result.rows.length,3,'vertical row gaps must separate three rows without relying on payment dates');
assert.strictEqual(result.rowSegmentation.confidence,'HIGH');
assert.strictEqual(result.rowSegmentation.sourceRowCountVerified,false);
assert.strictEqual(result.rows[0].values.nomor_permohonan,'171126046899');
assert.strictEqual(result.rows[1].values.nomor_permohonan,'161126042545');
assert.strictEqual(result.rows[2].values.nomor_permohonan,'161126043599');
assert.strictEqual(result.rows[0].values.nama,'MEHMET UZELE','wrapped cell text must combine within its row band');
assert.strictEqual(result.rows[0].values.jenis_kelamin,'MALE');
assert.strictEqual(result.rows[0].values.no_passport,'U37234274');
assert.strictEqual(result.rows[0].rowGeometry.lineCount,2);
assert.strictEqual(result.rows[1].rowGeometry.boundaryReason,'VERTICAL_GAP');
assert.strictEqual(result.rows[0].autoCommit,false);
assert.strictEqual(result.rows[0].reviewRequired,true);
assert.strictEqual(Object.keys(result.rows[0].fieldEvidence).length,17,'every field must have cell evidence, including empty cells');
assert.ok(result.rows[0].fieldEvidence.nama.bbox,'captured cells include OCR bounding box');
assert.strictEqual(result.rows[0].fieldEvidence.tanggal_auto_terbit.cellStatus,'EMPTY');
assert.ok(result.rows[0].fieldEvidence.tanggal_auto_terbit.reviewFlags.includes('CELL_EMPTY_OPTIONAL'));
assert.ok(!result.rows[0].validationWarnings.some(x=>x.field==='tanggal_auto_terbit'&&x.code==='CELL_EMPTY_OPTIONAL'));
assert.ok(result.rows[0].validationErrors.length===0,'optional empty cells must not become required-field errors');
assert.ok(Number.isFinite(result.rows[0].fieldEvidence.tanggal_auto_terbit.columnBounds.left));
assert.ok(Number.isFinite(result.rows[0].fieldEvidence.tanggal_auto_terbit.columnBounds.right));
assert.ok(result.rows[0].validationWarnings.some(x=>x.field==='tanggal_auto_terbit'&&x.code==='CELL_EMPTY'));
const invalidWords=words.map(w=>({...w,bbox:{...w.bbox}}));
invalidWords.push({text:'MALE?',confidence:52,bbox:{x0:x[9],y0:113,x1:x[9]+36,y1:124}});
invalidWords.push({text:'AB12-',confidence:48,bbox:{x0:x[12],y0:113,x1:x[12]+32,y1:124}});
const invalidResult=reconstructKanwilScreenshotTableV1(invalidWords,{lineTolerance:8,maxHeaderLines:6});
assert.strictEqual(invalidResult.autoCommit,false);
assert.ok(invalidResult.rows.every(row=>row.reviewRequired));
assert.ok(invalidResult.rows[0].fieldEvidence.jenis_kelamin.reviewFlags.includes('GENDER_VALUE_REQUIRES_REVIEW'));
console.log('Kanwil row geometry and cell integrity tests: PASS');
