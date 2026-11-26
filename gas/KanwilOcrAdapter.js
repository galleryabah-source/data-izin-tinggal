/** Validate that OCR output carries the current 17-column geometry/evidence contract. */
const KANWIL_OCR_REQUIRED_FIELDS_V1=[
 'tanggal_pembayaran','tanggal_mulai_verifikasi','tanggal_auto_terbit','layanan','kategori_produk',
 'nomor_permohonan','tanggal_permohonan','penjamin','nama','jenis_kelamin','tanggal_lahir',
 'kebangsaan','no_passport','jenis_produk','tujuan','posisi_permohonan','status_permohonan'
];
function validateKanwilScreenshotEvidenceV1(parsed){
 const failures=[];
 if(!parsed||parsed.ok!==true)failures.push('PARSER_DID_NOT_CONFIRM_SUCCESS');
 if(!Array.isArray(parsed&&parsed.header)||parsed.header.length!==17)failures.push('CANONICAL_HEADER_NOT_17');
 if(parsed&&parsed.matchedHeaderCount!==17)failures.push('MATCHED_HEADER_COUNT_NOT_17');
 if(parsed&&parsed.anchorGroupCount!==17)failures.push('ANCHOR_GROUP_COUNT_NOT_17');
 if(!Number.isFinite(parsed&&parsed.candidateLineCount)||parsed.candidateLineCount<1)failures.push('HEADER_CANDIDATE_LINES_MISSING');
 if(!Array.isArray(parsed&&parsed.headerDiagnostics)||parsed.headerDiagnostics.length!==17)failures.push('HEADER_DIAGNOSTICS_INCOMPLETE');
 if(!Array.isArray(parsed&&parsed.rows)||parsed.rows.length<1)failures.push('OCR_ROWS_MISSING');
 if(!parsed||parsed.autoCommit!==false)failures.push('OCR_AUTO_COMMIT_MUST_BE_DISABLED');
 if(parsed&&parsed.sourceRowCountVerified!==false)failures.push('OCR_MUST_NOT_CERTIFY_SOURCE_ROW_COUNT');
 (Array.isArray(parsed&&parsed.rows)?parsed.rows:[]).forEach((row,index)=>{
  const prefix='ROW_'+(index+1)+'_';
  if(!row||!row.rowGeometry||!Number.isFinite(row.rowGeometry.yStart)||!Number.isFinite(row.rowGeometry.yEnd)||
     !Number.isFinite(row.rowGeometry.lineCount)||row.rowGeometry.lineCount<1)failures.push(prefix+'GEOMETRY_MISSING');
  if(!row||!row.fieldEvidence||typeof row.fieldEvidence!=='object') {failures.push(prefix+'FIELD_EVIDENCE_MISSING');return;}
  KANWIL_OCR_REQUIRED_FIELDS_V1.forEach(key=>{
   const evidence=row.fieldEvidence[key];
   if(!evidence||!Array.isArray(evidence.words)){failures.push(prefix+'CELL_EVIDENCE_MISSING:'+key);return;}
   const value=String(row.values&&row.values[key]||'').trim();
   if(value&&(!evidence.words.length||!evidence.bbox||
      !['x0','y0','x1','y1'].every(k=>Number.isFinite(evidence.bbox[k]))))
    failures.push(prefix+'VALUE_WITHOUT_TOKEN_GEOMETRY:'+key);
  });
 });
 return {ok:failures.length===0,failures};
}
/** Converts Tesseract recognition output into evidence-rich Kanwil review rows. */
function adaptTesseractResultToKanwilV1(result,parser,options){
 if(!result||!result.data||!Array.isArray(result.data.words))return {ok:false,reason:'TESSERACT_WORDS_MISSING',rows:[],reviewRequired:true,autoCommit:false};
 if(typeof parser!=='function')return {ok:false,reason:'KANWIL_SCREENSHOT_PARSER_UNAVAILABLE',rows:[],reviewRequired:true,autoCommit:false};
 const words=result.data.words.map(w=>({text:String(w.text||''),confidence:Number.isFinite(w.confidence)?w.confidence:null,bbox:w.bbox?{x0:Number(w.bbox.x0),y0:Number(w.bbox.y0),x1:Number(w.bbox.x1),y1:Number(w.bbox.y1)}:null})).filter(w=>w.bbox&&Object.values(w.bbox).every(Number.isFinite)&&w.text.trim());
 const parsed=parser(words,options||{});
 if(!parsed.ok)return {...parsed,sourceText:String(result.data.text||''),engine:'TESSERACT.JS',rows:[],reviewRequired:true,autoCommit:false};
 const evidence=validateKanwilScreenshotEvidenceV1(parsed);
 if(!evidence.ok)return {...parsed,ok:false,reason:'OCR_EVIDENCE_CONTRACT_INCOMPLETE',evidenceFailures:evidence.failures,sourceText:String(result.data.text||''),engine:'TESSERACT.JS',rows:[],reviewRequired:true,autoCommit:false};
 return {...parsed,sourceText:String(result.data.text||''),engine:'TESSERACT.JS',reviewRequired:true,autoCommit:false,evidenceValidated:true};
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_OCR_REQUIRED_FIELDS_V1,validateKanwilScreenshotEvidenceV1,adaptTesseractResultToKanwilV1};
