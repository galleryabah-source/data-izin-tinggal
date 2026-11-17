/**
 * Browser-side XLSX adapter for Kanwil Permit v1.
 * Accepts SheetJS Community Edition (XLSX) as an injected dependency.
 * Does not load a CDN, call network, or persist workbook data.
 */
function parseKanwilXlsxV1(arrayBuffer, XLSX, options, csvParser, headerMapper) {
  if(!XLSX||!XLSX.read||!XLSX.utils||!XLSX.utils.sheet_to_json)
    return {ok:false,reason:'XLSX_ENGINE_UNAVAILABLE',records:[]};
  let workbook;
  try{workbook=XLSX.read(arrayBuffer,{type:'array',cellDates:false});}
  catch(e){return {ok:false,reason:'XLSX_READ_FAILED',detail:String(e&&e.message||e),records:[]};}
  const sheetName=options&&options.sheetName||workbook.SheetNames[0];
  if(!sheetName||!workbook.Sheets[sheetName])return {ok:false,reason:'WORKSHEET_NOT_FOUND',records:[]};
  let matrix;
  try{matrix=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,raw:false,defval:'',blankrows:false});}
  catch(e){return {ok:false,reason:'XLSX_SHEET_DECODE_FAILED',detail:String(e&&e.message||e),records:[]};}
  if(!Array.isArray(matrix)||!matrix.length)return {ok:false,reason:'EMPTY_WORKSHEET',records:[]};
  const mapHeaders=headerMapper||((headers)=>kanwilMapHeadersV1_(headers));\n  if(typeof mapHeaders!=='function')return {ok:false,reason:'KANWIL_HEADER_MAPPER_UNAVAILABLE',records:[]};\n  const candidates=matrix.map((row,index)=>({index,row,map:mapHeaders(row.map(v=>String(v==null?'':v)))}))
    .filter(x=>x.map.ok);
  if(candidates.length!==1)return {ok:false,reason:candidates.length?'MULTIPLE_HEADER_ROWS':'HEADER_MAPPING_INCOMPLETE_OR_AMBIGUOUS',headerCandidates:candidates.map(x=>x.index+1),records:[]};
  const headerIndex=candidates[0].index;
  const rows=matrix.slice(headerIndex).map(row=>row.map(v=>String(v==null?'':v)));
  const csv=rows.map(row=>row.map(v=>'"'+v.replace(/"/g,'""')+'"').join(',')).join('\n');
  const parseCsv=csvParser||((text)=>parseKanwilPermitCsvV1(text));\n  if(typeof parseCsv!=='function')return {ok:false,reason:'KANWIL_CSV_PARSER_UNAVAILABLE',records:[]};\n  const parsed=parseCsv(csv);
  if(!parsed.ok)return parsed;
  parsed.source={fileType:'XLSX',sheetName,headerRowNumber:headerIndex+1};
  parsed.records.forEach(record=>{record.sourceRowNumber+=headerIndex;});
  return parsed;
}
if(typeof module!=='undefined'&&module.exports)module.exports={parseKanwilXlsxV1};
