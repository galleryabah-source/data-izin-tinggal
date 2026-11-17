/** Browser-only XLSX adapter. Inject SheetJS and Kanwil contract functions; no network or persistence. */
function parseKanwilXlsxV1(arrayBuffer,XLSX,options,csvParser,headerMapper){
 if(!XLSX||typeof XLSX.read!=='function'||!XLSX.utils||typeof XLSX.utils.sheet_to_json!=='function')return {ok:false,reason:'XLSX_ENGINE_UNAVAILABLE',records:[]};
 if(typeof csvParser!=='function'||typeof headerMapper!=='function')return {ok:false,reason:'KANWIL_CONTRACT_DEPENDENCY_UNAVAILABLE',records:[]};
 let wb;try{wb=XLSX.read(arrayBuffer,{type:'array',cellDates:false});}catch(e){return {ok:false,reason:'XLSX_READ_FAILED',records:[]};}
 const sheetName=options&&options.sheetName||((wb.SheetNames||[])[0]);
 if(!sheetName||!wb.Sheets||!wb.Sheets[sheetName])return {ok:false,reason:'WORKSHEET_NOT_FOUND',records:[]};
 let matrix;try{matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,raw:false,defval:'',blankrows:false});}catch(e){return {ok:false,reason:'XLSX_SHEET_DECODE_FAILED',records:[]};}
 if(!Array.isArray(matrix)||!matrix.length)return {ok:false,reason:'EMPTY_WORKSHEET',records:[]};
 const candidates=matrix.map((row,index)=>({index,map:headerMapper(row.map(v=>String(v==null?'':v)))})).filter(x=>x.map&&x.map.ok);
 if(candidates.length!==1)return {ok:false,reason:candidates.length?'MULTIPLE_HEADER_ROWS':'HEADER_MAPPING_INCOMPLETE_OR_AMBIGUOUS',headerCandidates:candidates.map(x=>x.index+1),records:[]};
 const headerIndex=candidates[0].index;
 const data=matrix.slice(headerIndex).map(row=>row.map(v=>String(v==null?'':v)));
 const csv=data.map(row=>row.map(v=>'"'+v.replace(/"/g,'""')+'"').join(',')).join('\n');
 const parsed=csvParser(csv);
 if(!parsed||!parsed.ok)return parsed||{ok:false,reason:'CSV_PARSE_FAILED',records:[]};
 parsed.source={fileType:'XLSX',sheetName,headerRowNumber:headerIndex+1};
 (parsed.records||[]).forEach(record=>{record.sourceRowNumber+=headerIndex;});
 return parsed;
}
if(typeof module!=='undefined'&&module.exports)module.exports={parseKanwilXlsxV1};
