/**
 * Kanwil browser intake policy v1 — bounded local-file validation.
 * Does not inspect workbook/image contents; parser-level validation remains required.
 */
const KANWIL_INTAKE_LIMITS_V1=Object.freeze({maxFiles:50,maxFileBytes:20*1024*1024,maxBatchBytes:100*1024*1024,maxImageBytes:10*1024*1024});
const KANWIL_INTAKE_EXTENSIONS_V1=Object.freeze(['csv','xlsx','xls','jpg','jpeg','png']);
function validateKanwilLocalFilesV1(files){
 const list=Array.from(files||[]),errors=[];
 if(!list.length)errors.push({code:'NO_FILES_SELECTED'});
 if(list.length>KANWIL_INTAKE_LIMITS_V1.maxFiles)errors.push({code:'BATCH_FILE_LIMIT_EXCEEDED',limit:KANWIL_INTAKE_LIMITS_V1.maxFiles});
 let total=0;
 const accepted=[];
 list.forEach((file,index)=>{
  const name=String(file&&file.name||''),ext=(name.split('.').pop()||'').toLowerCase(),size=Number(file&&file.size);
  total+=Number.isFinite(size)&&size>0?size:0;
  if(!KANWIL_INTAKE_EXTENSIONS_V1.includes(ext))errors.push({code:'FILE_EXTENSION_UNSUPPORTED',index,name});
  if(!Number.isFinite(size)||size<=0)errors.push({code:'FILE_SIZE_INVALID',index,name});
  else if(size>KANWIL_INTAKE_LIMITS_V1.maxFileBytes)errors.push({code:'FILE_SIZE_LIMIT_EXCEEDED',index,name,limit:KANWIL_INTAKE_LIMITS_V1.maxFileBytes});
  if(['jpg','jpeg','png'].includes(ext)&&size>KANWIL_INTAKE_LIMITS_V1.maxImageBytes)errors.push({code:'IMAGE_SIZE_LIMIT_EXCEEDED',index,name,limit:KANWIL_INTAKE_LIMITS_V1.maxImageBytes});
  const mime=String(file&&file.type||'').toLowerCase();
  const allowed=ext==='csv'?['text/csv','text/plain','application/vnd.ms-excel']:ext==='xlsx'?['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream']:ext==='xls'?['application/vnd.ms-excel','application/octet-stream']:ext==='png'?['image/png']:['image/jpeg'];
  if(mime&&!allowed.includes(mime))errors.push({code:'FILE_MIME_EXTENSION_MISMATCH',index,name,mime});
  accepted.push({index,name,extension:ext,size:Number.isFinite(size)?size:0,mime:mime||null});
 });
 if(total>KANWIL_INTAKE_LIMITS_V1.maxBatchBytes)errors.push({code:'BATCH_SIZE_LIMIT_EXCEEDED',limit:KANWIL_INTAKE_LIMITS_V1.maxBatchBytes,total});
 return {ok:errors.length===0,errors,files:accepted,totalBytes:total,limits:KANWIL_INTAKE_LIMITS_V1};
}
if(typeof module!=='undefined'&&module.exports)module.exports={KANWIL_INTAKE_LIMITS_V1,validateKanwilLocalFilesV1};
