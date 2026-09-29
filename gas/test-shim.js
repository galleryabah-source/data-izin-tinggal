const fs=require('fs');
const path=require('path');
const files=fs.readdirSync(__dirname).filter(x=>/\.(gs|js)$/.test(x));
for(const name of files){new Function(fs.readFileSync(path.join(__dirname,name),'utf8'));}
const importCode=fs.readFileSync(path.join(__dirname,'ImportService.gs'),'utf8');
const pure=new Function(importCode+'\nreturn {normalizePeriod_,normalizeInteger_};')();
const assert=(condition,message)=>{if(!condition)throw new Error('TEST FAILED: '+message);};
assert(pure.normalizePeriod_('2026-01')==='2026-01','YYYY-MM period');
assert(pure.normalizePeriod_('Januari 2026')==='2026-01','Indonesian month period');
assert(pure.normalizePeriod_('8/2026')==='2026-08','numeric month period');
assert(pure.normalizeInteger_('1,234','bvk')===1234,'integer comma normalization');
const config=fs.readFileSync(path.join(__dirname,'Config.gs'),'utf8');
for(const key of ['RESIDENCE_PERMIT_SERVICE_MONTHLY','periode','kantor_imigrasi','bvk','voa','itk','itk_peralihan','itas','itap','itkt','alih_status_itk_ke_itas','alih_status_itas_ke_itap','abg','epo','imk','skim','total'])assert(config.includes(key),'contract contains '+key);
console.log('GAS source syntax and contract unit checks: OK');
