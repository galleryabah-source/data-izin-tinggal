/** Converts Tesseract recognition output into evidence-rich Kanwil review rows. */
function adaptTesseractResultToKanwilV1(result,parser,options){
 if(!result||!result.data||!Array.isArray(result.data.words))return {ok:false,reason:'TESSERACT_WORDS_MISSING',rows:[]};
 if(typeof parser!=='function')return {ok:false,reason:'KANWIL_SCREENSHOT_PARSER_UNAVAILABLE',rows:[]};
 const words=result.data.words.map(w=>({text:String(w.text||''),confidence:Number.isFinite(w.confidence)?w.confidence:null,bbox:w.bbox?{x0:Number(w.bbox.x0),y0:Number(w.bbox.y0),x1:Number(w.bbox.x1),y1:Number(w.bbox.y1)}:null})).filter(w=>w.bbox&&Object.values(w.bbox).every(Number.isFinite)&&w.text.trim());
 const parsed=parser(words,options||{});
 if(!parsed.ok)return {...parsed,sourceText:String(result.data.text||''),engine:'TESSERACT.JS',rows:[],reviewRequired:true,autoCommit:false};
 return {...parsed,sourceText:String(result.data.text||''),engine:'TESSERACT.JS',reviewRequired:true,autoCommit:false};
}
if(typeof module!=='undefined'&&module.exports)module.exports={adaptTesseractResultToKanwilV1};
